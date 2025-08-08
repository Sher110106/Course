import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { Doc } from "./_generated/dataModel";
import { getResourceEndpoint } from "./utils/azure";

const rootEndpoint = getResourceEndpoint(process.env.AZURE_OPENAI_ENDPOINT || "");

// Chat deployment (GPT-4 etc.)
const chatDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1";
const chatEndpoint = `${rootEndpoint}/openai/deployments/${chatDeployment}`;

// Configure OpenAI client for chat completions
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  baseURL: chatEndpoint,
  defaultQuery: {
    "api-version": process.env.OPENAI_API_VERSION || "2025-01-01-preview",
  },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  },
});

// Configure separate OpenAI client for embeddings with correct endpoint
const embeddingModel = process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-3-large';
const embeddingEndpoint = `${rootEndpoint}/openai/deployments/${embeddingModel}`;

const embeddingClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy-key',
  baseURL: embeddingEndpoint,
  defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION || '2024-02-01' },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY || 'dummy-key',
  },
});

// ---- In-memory caches ----
const embeddingCache = new Map<string, number[]>();
const similarityCache = new Map<string, number>();
const tfidfCache = new Map<string, Map<string, number>>(); // docId -> term -> tfidf
let idfCache: Map<string, number> | null = null;

function hashText(text: string): string {
  return text.toLowerCase().replace(/\W+/g, '').slice(0, 128);
}
function hashPair(a: string, b: string): string {
  return hashText(a) + '||' + hashText(b);
}

// ---- Caching wrappers ----
async function getCachedEmbedding(text: string): Promise<number[]> {
  const key = hashText(text);
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;
  const emb = await generateEmbedding(text);
  embeddingCache.set(key, emb);
  return emb;
}
async function getCachedSimilarity(a: string, b: string): Promise<number> {
  const key = hashPair(a, b);
  if (similarityCache.has(key)) return similarityCache.get(key)!;
  const sim = await calculateCourseSimilarity(a, b);
  similarityCache.set(key, sim);
  return sim;
}

// ---- TF-IDF Implementation ----
function computeIdf(corpus: string[]): Map<string, number> {
  const df = new Map<string, number>();
  const N = corpus.length;
  for (const doc of corpus) {
    const seen = new Set<string>();
    for (const word of doc.toLowerCase().split(/\W+/).filter(Boolean)) {
      if (!seen.has(word)) {
        df.set(word, (df.get(word) || 0) + 1);
        seen.add(word);
      }
    }
  }
  const idf = new Map<string, number>();
  for (const [term, freq] of df.entries()) {
    idf.set(term, Math.log(N / (1 + freq)));
  }
  return idf;
}
function computeTfidf(doc: string, idf: Map<string, number>): Map<string, number> {
  const tf = new Map<string, number>();
  const words = doc.toLowerCase().split(/\W+/).filter(Boolean);
  for (const word of words) {
    tf.set(word, (tf.get(word) || 0) + 1);
  }
  const tfidf = new Map<string, number>();
  for (const [word, freq] of tf.entries()) {
    tfidf.set(word, (freq / words.length) * (idf.get(word) || 0));
  }
  return tfidf;
}
function cosineSim(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [k, v] of a.entries()) {
    dot += v * (b.get(k) || 0);
    normA += v * v;
  }
  for (const v of b.values()) normB += v * v;
  return normA && normB ? dot / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

// ---- Text Processing Utilities for Enhanced Matching ----
function tokenizeText(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word => {
      // Filter out common words that don't add meaning
      const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'against', 'toward', 'towards', 'upon', 'across', 'behind', 'beneath', 'beside', 'beyond', 'inside', 'outside', 'under', 'over', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'extracted', 'transcript', 'curriculum', 'requirement'];
      return !stopWords.includes(word);
    });
}

function findOverlappingTerms(tokens1: string[], tokens2: string[]): string[] {
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  return Array.from(set1).filter(token => set2.has(token));
}

function calculateTermImportance(terms: string[], similarityScore: number): string[] {
  // Filter terms based on similarity score and term frequency
  const termFrequency = new Map<string, number>();
  for (const term of terms) {
    termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
  }
  
  // Relaxed filtering: include terms if similarity is high OR if they're meaningful words
  const meaningfulWords = [
    // Academic subjects
    'engineering', 'physics', 'computer', 'science', 'mathematics', 'calculus', 'programming', 'data', 'structure', 'algorithm', 'database', 'network', 'software', 'system', 'design', 'analysis', 'management', 'development', 'technology', 'information',
    // Economics and business
    'economics', 'finance', 'accounting', 'marketing', 'business', 'management', 'strategy', 'market', 'investment', 'trade', 'commerce', 'entrepreneurship',
    // Engineering disciplines
    'mechanical', 'electrical', 'civil', 'chemical', 'biomedical', 'aerospace', 'industrial', 'environmental', 'materials', 'nuclear', 'petroleum', 'mining',
    // Computer science
    'artificial', 'intelligence', 'machine', 'learning', 'deep', 'neural', 'network', 'cybersecurity', 'blockchain', 'cloud', 'computing', 'web', 'mobile', 'application',
    // Mathematics and statistics
    'statistics', 'probability', 'linear', 'algebra', 'geometry', 'trigonometry', 'differential', 'integral', 'optimization', 'numerical', 'discrete', 'continuous',
    // Physics and chemistry
    'thermodynamics', 'mechanics', 'dynamics', 'kinematics', 'optics', 'electromagnetism', 'quantum', 'atomic', 'molecular', 'organic', 'inorganic', 'biochemistry',
    // General academic terms
    'research', 'methodology', 'theory', 'practice', 'laboratory', 'experiment', 'project', 'thesis', 'dissertation', 'seminar', 'workshop', 'tutorial'
  ];
  
  return Array.from(termFrequency.entries())
    .filter(([term, frequency]) => {
      // Include if similarity is high OR if it's a meaningful word OR if it appears multiple times
      return similarityScore > 0.3 || meaningfulWords.includes(term.toLowerCase()) || frequency > 1;
    })
    .map(([term]) => term)
    .slice(0, 10); // Limit to top 10 most important terms
}

function extractHighlightedPhrases(text: string, importantTerms: string[]): string[] {
  const phrases: string[] = [];
  
  // If no important terms, return the full text as a highlight
  if (importantTerms.length === 0) {
    return [text];
  }
  
  // Split text into sentences or phrases
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    for (const term of importantTerms) {
      if (lowerSentence.includes(term.toLowerCase())) {
        // Extract the phrase containing the term with more context
        const termIndex = lowerSentence.indexOf(term.toLowerCase());
        const start = Math.max(0, termIndex - 30);
        const end = Math.min(sentence.length, termIndex + term.length + 30);
        const phrase = sentence.substring(start, end).trim();
        
        // Only add if phrase is meaningful (not too short, not just the term itself)
        if (phrase.length > term.length + 5 && phrase !== term) {
          phrases.push(phrase);
        }
      }
    }
  }
  
  // If no specific phrases found, try to extract meaningful parts
  if (phrases.length === 0) {
    // Look for meaningful words in the text
    const words = text.split(/\s+/).filter(word => word.length > 3);
    const meaningfulWords = words.filter(word => 
      /[A-Z]/.test(word) || // Contains uppercase (likely a proper noun)
      /^[A-Za-z]+$/.test(word) // Pure alphabetic word
    );
    
    if (meaningfulWords.length > 0) {
      // Create phrases from meaningful words
      for (let i = 0; i < Math.min(meaningfulWords.length, 3); i++) {
        const word = meaningfulWords[i];
        const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
        if (wordIndex !== -1) {
          const start = Math.max(0, wordIndex - 20);
          const end = Math.min(text.length, wordIndex + word.length + 20);
          const phrase = text.substring(start, end).trim();
          if (phrase.length > word.length + 5) {
            phrases.push(phrase);
          }
        }
      }
    }
  }
  
  // If still no phrases found, return the full text
  if (phrases.length === 0) {
    return [text];
  }
  
  return phrases.slice(0, 3); // Limit to 3 phrases
}

function extractMatchingHighlights(
  userDescription: string,
  curriculumDescription: string,
  similarityScore: number
): {
  userHighlights: string[],
  curriculumHighlights: string[]
} {
  console.log("[Highlights] Extracting highlights for similarity score:", similarityScore);
  console.log("[Highlights] User description:", userDescription);
  console.log("[Highlights] Curriculum description:", curriculumDescription);
  
  // 1. Tokenize both descriptions
  const userTokens = tokenizeText(userDescription);
  const curriculumTokens = tokenizeText(curriculumDescription);
  
  console.log("[Highlights] User tokens:", userTokens);
  console.log("[Highlights] Curriculum tokens:", curriculumTokens);
  
  // 2. Find overlapping terms
  const overlappingTerms = findOverlappingTerms(userTokens, curriculumTokens);
  console.log("[Highlights] Overlapping terms:", overlappingTerms);
  
  // 3. Calculate term importance
  const importantTerms = calculateTermImportance(overlappingTerms, similarityScore);
  console.log("[Highlights] Important terms:", importantTerms);
  
  // 4. Return full descriptions with highlighted terms (will be processed by frontend)
  // The frontend will use these terms to highlight within the full descriptions
  return { 
    userHighlights: importantTerms, // Pass the matching terms to frontend
    curriculumHighlights: importantTerms // Pass the matching terms to frontend
  };
}

function calculateSimilarityBreakdown(
  vectorScore: number,
  tfidfScore: number,
  semanticScore: number
): {
  vectorScore: number,
  tfidfScore: number,
  semanticScore: number,
  finalScore: number
} {
  // Weighted sum: 0.3 * vector + 0.3 * tfidf + 0.4 * semantic
  const finalScore = 0.3 * vectorScore + 0.3 * tfidfScore + 0.4 * semanticScore;
  
  return {
    vectorScore,
    tfidfScore,
    semanticScore,
    finalScore
  };
}

// Analyze dual transcript using hybrid method (vector + TF-IDF + semantic)
export const analyzeDualTranscript = action({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    targetSemester: v.number(),
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      userCourse: string,
      curriculumCourse: string,
      similarity: number,
      grade: string,
      // Enhanced fields for detailed matching
      userCourseDescription?: string,
      curriculumCourseDescription?: string,
      similarityBreakdown?: {
        vectorScore: number,
        tfidfScore: number,
        semanticScore: number,
        finalScore: number,
      },
      matchingHighlights?: {
        userHighlights: string[],
        curriculumHighlights: string[],
      },
      userCourseCode?: string,
      curriculumCourseCode?: string,
    }>;
    gapCourses: Array<{
      code: string,
      title: string,
      description: string,
      semester?: number,
      priority: "high" | "medium" | "low",
    }>;
    recommendations: Array<{
      type: "prerequisite" | "elective" | "core",
      message: string,
      courses: string[],
    }>;
    totalUserCourses: number;
    totalMatched: number;
    totalGaps: number;
    targetSemester: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get dual transcript
    const dualTranscript: Doc<"dualTranscripts"> | null = await ctx.runQuery(internal.dualTranscripts.getDualTranscriptById, {
      dualTranscriptId: args.dualTranscriptId,
    });

    if (!dualTranscript || dualTranscript.userId !== userId) {
      throw new Error("Dual transcript not found or unauthorized");
    }

    if (!dualTranscript.extractedCourses) {
      throw new Error("Dual transcript not processed yet");
    }

    // Get Plaksha's predefined curriculum courses (like normal PDF implementation)
    const plakshaCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getPlakshaCourses);
    
    // Get courses up to the target semester for gap analysis
    const coreRequirements: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoreRequirementsBySemester, {
      maxSemester: args.targetSemester - 1
    });

    console.log(`[Dual Analysis] Processing ${dualTranscript.extractedCourses.length} user courses against ${plakshaCourses.length} Plaksha curriculum courses`);
    
    // Debug: Log sample course descriptions
    console.log(`[Dual Analysis] Sample user course descriptions:`);
    dualTranscript.extractedCourses.slice(0, 3).forEach((course, i) => {
      console.log(`  ${i + 1}. ${course.title}: "${course.description}"`);
    });
    
    console.log(`[Dual Analysis] Sample curriculum course descriptions:`);
    plakshaCourses.slice(0, 3).forEach((course, i) => {
      console.log(`  ${i + 1}. ${course.title}: "${course.description}"`);
    });

    const matchedCourses: Array<{
      userCourse: string,
      curriculumCourse: string,
      similarity: number,
      grade: string,
      // Enhanced fields for detailed matching
      userCourseDescription?: string,
      curriculumCourseDescription?: string,
      similarityBreakdown?: {
        vectorScore: number,
        tfidfScore: number,
        semanticScore: number,
        finalScore: number,
      },
      matchingHighlights?: {
        userHighlights: string[],
        curriculumHighlights: string[],
      },
      userCourseCode?: string,
      curriculumCourseCode?: string,
    }> = [];
    const matchedCurriculumCodes = new Set<string>();

    // TF-IDF-based similarity - precompute IDF once
    if (!idfCache) {
      const allDocs = plakshaCourses.map(c => c.description);
      idfCache = computeIdf(allDocs);
    }

    // Helper to get cached TF-IDF vector
    function getTfidfVec(doc: string, cacheKey: string): Map<string, number> {
      if (tfidfCache.has(cacheKey)) return tfidfCache.get(cacheKey)!;
      const vec = computeTfidf(doc, idfCache!);
      tfidfCache.set(cacheKey, vec);
      return vec;
    }

    // Step 1: Generate embeddings for all user courses at once
    const userEmbeddings = await Promise.all(
      dualTranscript.extractedCourses.map(async (course) => ({
        course,
        embedding: await getCachedEmbedding(course.description)
      }))
    );

    // Step 3: Filter comparisons by TF-IDF score and batch AI similarity calls
    const TFIDF_THRESHOLD = 0.05; // Lowered threshold - only proceed with AI calls if TF-IDF score is above this threshold
    const TOP_K = 5; // Increased from 3 to 5 - for each user course, consider top K curriculum courses by TF-IDF
    
    // Group comparisons by user course and filter by TF-IDF score
    const userCourseComparisons = new Map<string, Array<{
      userCourse: any;
      curriculumCourse: any;
      vectorScore: number;
      tfidfScore: number;
    }>>();

    for (const { course: userCourse, embedding: userEmbedding } of userEmbeddings) {
      if (!userEmbedding || userEmbedding.length === 0) {
        console.warn(`[Dual Analysis] Skipping course due to empty embedding: ${userCourse.title}`);
        continue;
      }

      const comparisons: Array<{
        userCourse: any;
        curriculumCourse: any;
        vectorScore: number;
        tfidfScore: number;
      }> = [];

      // Compare against all curriculum courses
      for (const curriculumCourse of plakshaCourses) {
        // Calculate TF-IDF score
        const tfidfA = getTfidfVec(userCourse.description, 'user:' + hashText(userCourse.description));
        const tfidfB = getTfidfVec(curriculumCourse.description, 'curriculum:' + curriculumCourse.code);
        const tfidfScore = cosineSim(tfidfA, tfidfB);

        // For vector similarity, we'll use a simplified approach since we don't have vector embeddings for curriculum courses
        // We'll use TF-IDF as a proxy for vector similarity
        const vectorScore = tfidfScore; // Simplified approach

        comparisons.push({
          userCourse,
          curriculumCourse,
          vectorScore,
          tfidfScore
        });
      }

      // Sort by TF-IDF score and take top K
      const topComparisons = comparisons
        .filter(comp => comp.tfidfScore > TFIDF_THRESHOLD)
        .sort((a, b) => b.tfidfScore - a.tfidfScore)
        .slice(0, TOP_K);

      userCourseComparisons.set(userCourse.title, topComparisons);
    }

    // Flatten all filtered comparisons
    const filteredComparisons = Array.from(userCourseComparisons.values()).flat();
    
    // Calculate total possible comparisons for logging
    const totalPossibleComparisons = dualTranscript.extractedCourses.length * plakshaCourses.length;
    
    console.log(`[Dual Analysis] Filtered from ${totalPossibleComparisons} to ${filteredComparisons.length} course pairs (TF-IDF threshold: ${TFIDF_THRESHOLD}, top-K: ${TOP_K})`);
    
    // Debug: Log some sample TF-IDF scores to understand the distribution
    if (filteredComparisons.length > 0) {
      const sampleScores = filteredComparisons.slice(0, 5).map(comp => comp.tfidfScore);
      console.log(`[Dual Analysis] Sample TF-IDF scores: ${sampleScores.map(s => s.toFixed(3)).join(', ')}`);
    }
    
    const BATCH_SIZE = 10;
    const allResults: Array<{
      userCourse: any;
      curriculumCourse: any;
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
      finalScore: number;
    }> = [];

    for (let i = 0; i < filteredComparisons.length; i += BATCH_SIZE) {
      const batch = filteredComparisons.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(async ({ userCourse, curriculumCourse, vectorScore, tfidfScore }) => {
        let semanticScore = 0;
        try {
          semanticScore = await getCachedSimilarity(userCourse.description, curriculumCourse.description);
        } catch (e) {
          semanticScore = 0;
        }

        // Weighted sum: 0.3 * vector + 0.3 * tfidf + 0.4 * semantic
        const finalScore = 0.3 * vectorScore + 0.3 * tfidfScore + 0.4 * semanticScore;

        // Debug: Log some sample final scores
        if (allResults.length < 5) {
          console.log(`[Dual Analysis] Sample final score: ${finalScore.toFixed(3)} (vector: ${vectorScore.toFixed(3)}, tfidf: ${tfidfScore.toFixed(3)}, semantic: ${semanticScore.toFixed(3)})`);
        }

        return {
          userCourse,
          curriculumCourse,
          vectorScore,
          tfidfScore,
          semanticScore,
          finalScore
        };
      }));

      allResults.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < filteredComparisons.length) {
        await sleep(100);
      }
    }

    // Step 4: Find best matches for each user course
    const userCourseMatches = new Map<string, {
      curriculumCourse: any;
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
      finalScore: number;
    }>();

    for (const result of allResults) {
      const userCourseKey = result.userCourse.title;
      const currentBest = userCourseMatches.get(userCourseKey);
      
              if (!currentBest || result.finalScore > currentBest.finalScore) {
          if (result.finalScore > 0.25) { // Lowered final threshold from 0.4 to 0.25
            userCourseMatches.set(userCourseKey, {
              curriculumCourse: result.curriculumCourse,
              vectorScore: result.vectorScore,
              tfidfScore: result.tfidfScore,
              semanticScore: result.semanticScore,
              finalScore: result.finalScore
            });
          }
        }
    }

    // Step 5: Build final results with enhanced data
    console.log(`[Dual Analysis] Found ${userCourseMatches.size} matches after final threshold filtering (threshold: 0.25)`);
    
    for (const [userCourseTitle, match] of userCourseMatches) {
      const userCourse = dualTranscript.extractedCourses.find(c => c.title === userCourseTitle);
      if (userCourse) {
        // Extract matching highlights
        const highlights = extractMatchingHighlights(
          userCourse.description,
          match.curriculumCourse.description,
          match.finalScore
        );
        
        // Calculate similarity breakdown
        const breakdown = calculateSimilarityBreakdown(
          match.vectorScore,
          match.tfidfScore,
          match.semanticScore
        );
        
        matchedCourses.push({
          userCourse: userCourse.title,
          curriculumCourse: match.curriculumCourse.title,
          similarity: match.finalScore,
          grade: userCourse.grade,
          // NEW ENHANCED FIELDS
          userCourseDescription: userCourse.description,
          curriculumCourseDescription: match.curriculumCourse.description,
          similarityBreakdown: breakdown,
          matchingHighlights: highlights,
          userCourseCode: (userCourse as any).code || undefined,
          curriculumCourseCode: match.curriculumCourse.code,
        });
        matchedCurriculumCodes.add(match.curriculumCourse.code);
      }
    }

    // Step 5.5: Try course code matching for unmatched courses
    if (matchedCourses.length === 0) {
      console.log(`[Dual Analysis] No similarity matches found, trying course code matching...`);
      
      const codeMatches = await ctx.runMutation(internal.courseExtraction.matchCoursesByCode, {
        userCourses: dualTranscript.extractedCourses.map(c => ({
          title: c.title,
          description: c.description,
          grade: c.grade,
          code: (c as any).code,
        })),
        curriculumCourses: plakshaCourses.map(c => ({
          code: c.code,
          title: c.title,
          description: c.description,
        })),
      });

      console.log(`[Dual Analysis] Found ${codeMatches.length} matches via course code matching`);

      for (const codeMatch of codeMatches) {
        const userCourse = dualTranscript.extractedCourses.find(c => c.title === codeMatch.userCourse);
        const curriculumCourse = plakshaCourses.find(c => c.title === codeMatch.curriculumCourse);
        
        if (userCourse && curriculumCourse) {
          matchedCourses.push({
            userCourse: userCourse.title,
            curriculumCourse: curriculumCourse.title,
            similarity: codeMatch.confidence,
            grade: userCourse.grade,
            userCourseDescription: userCourse.description,
            curriculumCourseDescription: curriculumCourse.description,
            similarityBreakdown: {
              vectorScore: codeMatch.confidence,
              tfidfScore: codeMatch.confidence,
              semanticScore: codeMatch.confidence,
              finalScore: codeMatch.confidence,
            },
            matchingHighlights: {
              userHighlights: [codeMatch.matchType],
              curriculumHighlights: [codeMatch.matchType],
            },
            userCourseCode: (userCourse as any).code || undefined,
            curriculumCourseCode: curriculumCourse.code,
          });
          matchedCurriculumCodes.add(curriculumCourse.code);
        }
      }
    }

    // Step 6: Identify gap courses (curriculum requirements not matched)
    const gapCourses = coreRequirements
      .filter((course) => !matchedCurriculumCodes.has(course.code))
      .map((course) => ({
        code: course.code,
        title: course.title,
        description: course.description,
        semester: course.semester,
        priority: course.isCoreRequirement ? "high" as const : "medium" as const,
      }));

    // Step 7: Generate recommendations
    const recommendations = await generateRecommendations(
      dualTranscript.extractedCourses,
      gapCourses,
      args.targetSemester
    );

    // Step 8: Update dual transcript with analysis results
    await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptAnalysis, {
      dualTranscriptId: args.dualTranscriptId,
      analysisResults: {
        matchedCourses,
        gapCourses,
        recommendations,
      },
    });

    return {
      matchedCourses,
      gapCourses,
      recommendations,
      totalUserCourses: dualTranscript.extractedCourses.length,
      totalMatched: matchedCourses.length,
      totalGaps: gapCourses.length,
      targetSemester: args.targetSemester,
    };
  },
});

// Test function to trigger dual analysis for debugging
export const testDualAnalysis = action({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      userCourse: string,
      curriculumCourse: string,
      similarity: number,
      grade: string,
      userCourseDescription?: string,
      curriculumCourseDescription?: string,
      similarityBreakdown?: {
        vectorScore: number,
        tfidfScore: number,
        semanticScore: number,
        finalScore: number,
      },
      matchingHighlights?: {
        userHighlights: string[],
        curriculumHighlights: string[],
      },
      userCourseCode?: string,
      curriculumCourseCode?: string,
    }>;
    gapCourses: Array<{
      code: string,
      title: string,
      description: string,
      semester?: number,
      priority: "high" | "medium" | "low",
    }>;
    recommendations: Array<{
      type: "prerequisite" | "elective" | "core",
      message: string,
      courses: string[],
    }>;
    totalUserCourses: number;
    totalMatched: number;
    totalGaps: number;
    targetSemester: number;
  }> => {
    console.log("[Test] Triggering dual analysis for transcript:", args.dualTranscriptId);
    
    const result = await ctx.runAction(api.dualAnalysis.analyzeDualTranscript, {
      dualTranscriptId: args.dualTranscriptId,
      targetSemester: 4,
    });
    
    console.log("[Test] Dual analysis result:", {
      totalUserCourses: result.totalUserCourses,
      totalMatched: result.totalMatched,
      totalGaps: result.totalGaps,
    });
    
    return result;
  },
});

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  console.log("[Embedding] Input:", JSON.stringify(text));
  console.log("[Embedding] Input type:", typeof text);
  console.log("[Embedding] Input length:", text?.length);
  
  if (typeof text !== "string" || !text.trim()) {
    console.error("[Embedding] Invalid input for embedding:", text);
    throw new Error("Embedding input must be a non-empty string.");
  }
  
  // Skip embedding for placeholder or instructional text
  const lowerText = text.toLowerCase();
  if (
    lowerText.includes("placeholder course") ||
    lowerText.includes("manually add your actual courses") ||
    lowerText.includes("in production, ai would parse your actual transcript")
  ) {
    console.warn("[Embedding] Skipping placeholder/instructional text for embedding:", text);
    return [];
  }
  
  console.log("[Embedding] Sending to OpenAI API:", text.slice(0, 100));
  
  console.log("[Embedding] Using model:", embeddingModel);
  console.log("[Embedding] Using endpoint:", embeddingEndpoint);
  
  try {
    const requestPayload = {
      model: embeddingModel,
      input: text,
    };
    console.log("[Embedding] Request payload:", JSON.stringify(requestPayload));
    
    const response = await embeddingClient.embeddings.create(requestPayload);
    
    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error("Invalid response from OpenAI embeddings API");
    }
    
    const emb = response.data[0].embedding;
    console.log("[Embedding] Received embedding (length):", emb.length, "Sample:", emb.slice(0, 5));
    return emb;
  } catch (error) {
    console.error("[Embedding] Error from OpenAI API:", error);
    console.error("[Embedding] Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: (error as any)?.status,
      code: (error as any)?.code,
      type: (error as any)?.type,
      param: (error as any)?.param,
    });
    throw error;
  }
}

// Calculate similarity between two course descriptions using AI
async function calculateCourseSimilarity(desc1: string, desc2: string): Promise<number> {
  try {
    const prompt = `
Compare these two course descriptions and return a similarity score between 0 and 1, where 1 means identical content and 0 means completely unrelated.

Course 1: ${desc1}

Course 2: ${desc2}

Consider:
- Learning objectives and outcomes
- Topics covered
- Skill development
- Prerequisites and level

Return only a decimal number between 0 and 1.`;

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const similarityText = response.choices[0].message.content?.trim();
    const similarity = parseFloat(similarityText || "0");
    
    return isNaN(similarity) ? 0 : Math.max(0, Math.min(1, similarity));
  } catch (error) {
    console.error("Error calculating similarity:", error);
    return 0;
  }
}

// Generate recommendations based on analysis results
async function generateRecommendations(
  userCourses: Array<{ title: string; description: string; grade: string }>,
  gapCourses: Array<{ code: string; title: string; description: string; priority: string }>,
  targetSemester: number
): Promise<Array<{
  type: "prerequisite" | "elective" | "core",
  message: string,
  courses: string[],
}>> {
  const recommendations = [];

  // Analyze user's performance
  const gradeValues = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  };

  const userGrades = userCourses.map(course => gradeValues[course.grade as keyof typeof gradeValues] || 0);
  const averageGrade = userGrades.length > 0 ? userGrades.reduce((a, b) => a + b, 0) / userGrades.length : 0;

  // High priority gaps (required courses)
  const highPriorityGaps = gapCourses.filter(course => course.priority === "high");
  if (highPriorityGaps.length > 0) {
    recommendations.push({
      type: "core" as const,
      message: `Focus on completing ${highPriorityGaps.length} required courses to meet curriculum requirements.`,
      courses: highPriorityGaps.map(course => course.title),
    });
  }

  // Performance-based recommendations
  if (averageGrade >= 3.5) {
    recommendations.push({
      type: "elective" as const,
      message: "Your strong academic performance suggests you can handle challenging elective courses.",
      courses: gapCourses.filter(course => course.priority === "medium").map(course => course.title),
    });
  } else if (averageGrade < 2.5) {
    recommendations.push({
      type: "prerequisite" as const,
      message: "Consider strengthening foundational knowledge before taking advanced courses.",
      courses: gapCourses.filter(course => course.priority === "medium").slice(0, 3).map(course => course.title),
    });
  }

  // Semester-specific recommendations
  if (targetSemester <= 4) {
    recommendations.push({
      type: "core" as const,
      message: "Early in your program - focus on building strong foundations.",
      courses: gapCourses.slice(0, 5).map(course => course.title),
    });
  } else {
    recommendations.push({
      type: "elective" as const,
      message: "Advanced semester - consider specialized courses aligned with your interests.",
      courses: gapCourses.slice(0, 3).map(course => course.title),
    });
  }

  return recommendations;
}

// Utility: sleep for ms milliseconds
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Get latest dual analysis result
export const getLatestDualAnalysis = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const results = await ctx.db
      .query("dualTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    return results[0] || null;
  },
}); 