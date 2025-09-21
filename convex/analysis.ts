import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { Doc } from "./_generated/dataModel";
import { getResourceEndpoint } from "./utils/azure";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

// Perform curriculum gap analysis for manually entered courses
export const analyzeCurriculum = action({
  args: {
    targetSemester: v.number(),
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      userCourseId: Doc<"userCourses">["_id"];
      userCourseTitle: string;
      plakshaCourseCode: string;
      plakshaCourseTitle: string;
      similarity: number;
    }>;
    gapCourses: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
    }>;
    futureChallenges: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
      difficulty: string;
      reason: string;
    }>;
    totalUserCourses: number;
    totalMatched: number;
    totalGaps: number;
    targetSemester: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user's courses and Plaksha curriculum
    const userCourses: Doc<"userCourses">[] = await ctx.runQuery(api.courses.getUserCourses);
    const plakshaCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getPlakshaCourses);
    
    // Get courses up to the target semester for gap analysis
    const coreRequirements: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoreRequirementsBySemester, {
      maxSemester: args.targetSemester - 1
    });

    // Get future courses for difficulty prediction
    const futureCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoursesBySemester, {
      semester: args.targetSemester
    });

    if (userCourses.length === 0) {
      throw new Error("Please add at least one course before analyzing");
    }

    const matchedCourses: Array<{
      userCourseId: Doc<"userCourses">["_id"];
      userCourseTitle: string;
      plakshaCourseCode: string;
      plakshaCourseTitle: string;
      similarity: number;
    }> = [];
    const matchedPlakshaCodes = new Set<string>();

    // Analyze each user course against Plaksha curriculum
    for (const userCourse of userCourses) {
      let bestMatch: Doc<"plakshaCourses"> | null = null;
      let bestSimilarity = 0;

      for (const plakshaCourse of plakshaCourses) {
        const similarity = await getCachedSimilarity(
          userCourse.description,
          plakshaCourse.description
        );

        if (similarity > bestSimilarity && similarity >= 0.7) {
          bestSimilarity = similarity;
          bestMatch = plakshaCourse;
        }
      }

      if (bestMatch) {
        matchedCourses.push({
          userCourseId: userCourse._id,
          userCourseTitle: userCourse.title,
          plakshaCourseCode: bestMatch.code,
          plakshaCourseTitle: bestMatch.title,
          similarity: bestSimilarity,
        });
        matchedPlakshaCodes.add(bestMatch.code);
      }
    }

    // Identify gap courses (core requirements not matched)
    const gapCourses = coreRequirements
      .filter((course: Doc<"plakshaCourses">) => !matchedPlakshaCodes.has(course.code))
      .map((course: Doc<"plakshaCourses">) => ({
        code: course.code,
        title: course.title,
        department: course.department,
        semester: course.semester || 0,
      }));

    // Analyze future course difficulty
    const futureChallenges = await analyzeFutureCourses(userCourses, futureCourses);

    // Save analysis result
    await ctx.runMutation(internal.analysis.saveAnalysisResult, {
      userId,
      transcriptId: undefined,
      matchedCourses,
      gapCourses,
      futureChallenges,
      analysisDate: Date.now(),
      targetSemester: args.targetSemester,
      analysisType: "manual",
    });

    return {
      matchedCourses,
      gapCourses,
      futureChallenges,
      totalUserCourses: userCourses.length,
      totalMatched: matchedCourses.length,
      totalGaps: gapCourses.length,
      targetSemester: args.targetSemester,
    };
  },
});

// Analyze transcript using vector search
export const analyzeTranscript = action({
  args: {
    transcriptId: v.id("userTranscripts"),
    targetSemester: v.number(),
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      userCourseId?: Doc<"userCourses">["_id"];
      userCourseTitle: string;
      plakshaCourseCode: string;
      plakshaCourseTitle: string;
      similarity: number;
    }>;
    gapCourses: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
    }>;
    futureChallenges: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
      difficulty: string;
      reason: string;
    }>;
    totalUserCourses: number;
    totalMatched: number;
    totalGaps: number;
    targetSemester: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get transcript
    const transcript: Doc<"userTranscripts"> | null = await ctx.runQuery(internal.transcriptData.getTranscriptById, {
      transcriptId: args.transcriptId,
    });

    if (!transcript || transcript.userId !== userId) {
      throw new Error("Transcript not found or unauthorized");
    }

    if (!transcript.parsedCourses) {
      throw new Error("Transcript not processed yet");
    }

    console.log("[Analysis] parsedCourses from transcript:", JSON.stringify(transcript.parsedCourses, null, 2));

    // Get core requirements for gap analysis
    const coreRequirements: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoreRequirementsBySemester, {
      maxSemester: args.targetSemester - 1
    });

    // Get future courses for difficulty prediction
    const futureCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoursesBySemester, {
      semester: args.targetSemester
    });

    const matchedCourses = [];
    const matchedPlakshaCodes = new Set<string>();

    // Use vector search for each parsed course
    for (const parsedCourse of transcript.parsedCourses) {
      console.log("[Analysis] Processing course:", JSON.stringify(parsedCourse));
      const embedding = await getCachedEmbedding(parsedCourse.description);
      if (!embedding || embedding.length === 0) {
        console.warn("[Analysis] Skipping vector search for course due to empty embedding:", parsedCourse.description);
        continue;
      }
      console.log("[Analysis] Embedding generated (length):", embedding.length, "Sample:", embedding.slice(0, 5));
      const searchResults = await ctx.vectorSearch("plakshaCourses", "by_embedding", {
        vector: embedding,
        limit: 5,
      });
      console.log("[Analysis] Vector search results count:", searchResults.length, searchResults.length > 0 ? "Top match score:" + searchResults[0]._score : "No matches");
      // Find the best match above threshold
      for (const result of searchResults) {
        if (result._score > 0.6) { // Loosened threshold for vector search
          // Get the full course document
          const plakshaCourse = await ctx.runQuery(api.courses.getPlakshaCourses);
          const matchedCourse = plakshaCourse.find((c: any) => c._id === result._id);
          if (matchedCourse) {
            matchedCourses.push({
              userCourseId: undefined,
              userCourseTitle: parsedCourse.title,
              plakshaCourseCode: matchedCourse.code,
              plakshaCourseTitle: matchedCourse.title,
              similarity: result._score,
            });
            matchedPlakshaCodes.add(matchedCourse.code);
            break; // Take only the best match per course
          }
        }
      }
    }

    // Identify gap courses
    const gapCourses = coreRequirements
      .filter((course: Doc<"plakshaCourses">) => !matchedPlakshaCodes.has(course.code))
      .map((course: Doc<"plakshaCourses">) => ({
        code: course.code,
        title: course.title,
        department: course.department,
        semester: course.semester || 0,
      }));

    // Convert parsed courses to user course format for future analysis
    const userCoursesForAnalysis = transcript.parsedCourses.map((course: any) => ({
      _id: "" as any,
      userId: userId,
      title: course.title,
      description: course.description,
      credits: course.credits,
      _creationTime: Date.now(),
    }));

    // Analyze future course difficulty
    const futureChallenges = await analyzeFutureCourses(userCoursesForAnalysis, futureCourses);

    // Save analysis result
    await ctx.runMutation(internal.analysis.saveAnalysisResult, {
      userId,
      transcriptId: args.transcriptId,
      matchedCourses,
      gapCourses,
      futureChallenges,
      analysisDate: Date.now(),
      targetSemester: args.targetSemester,
      analysisType: "transcript",
    });

    return {
      matchedCourses,
      gapCourses,
      futureChallenges,
      totalUserCourses: transcript.parsedCourses.length,
      totalMatched: matchedCourses.length,
      totalGaps: gapCourses.length,
      targetSemester: args.targetSemester,
    };
  },
});

// Single-pass Gemini 2.5 Flash matching between two full-document texts
export const geminiDualMatch = action({
  args: {
    textA: v.string(),
    textB: v.string(),
    minGrade: v.string(),
  },
  handler: async (_ctx, args): Promise<any> => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `Extract courses from Document A (transcript) and match them with descriptions from Document B (course of study).

For each course in Document A, provide:
- courseCode: Course code from transcript
- courseName: Course name from transcript  
- description: Best matching description from Document B
- grade: Grade from transcript (if available)
- credits: Credits/hours from transcript (look for numbers like 3, 4, 3.0, 4.0)
- meetsMinGrade: true if grade >= minGrade threshold, false otherwise
- sourceConfidence: 0-1 confidence score

Grade threshold: Set meetsMinGrade=true only if grade >= minGrade (A+ > A > A- > B+ > B > B- > C+ > C > C- > D+ > D > D- > F).
Special cases: "P"/"Pass" = above threshold if minGrade ≤ D. "N/A", "NA", missing grades = below threshold.

Return valid JSON only:
{
  "matches": [
    {
      "courseCode": "CS101",
      "courseName": "Introduction to Programming", 
      "description": "Course description...",
      "grade": "A",
      "credits": 3,
      "meetsMinGrade": true,
      "sourceConfidence": 0.95
    }
  ],
  "unmatched": [
    {
      "courseCode": "MATH101",
      "courseName": "Calculus I",
      "reason": "no_match_found"
    }
  ],
  "stats": {
    "minGrade": "B",
    "executionMode": "dual_document",
    "totalCourses": 24,
    "matchedCount": 20,
    "unmatchedCount": 4
  }
}`;

    const userContent = `minGrade: ${args.minGrade}\n\nDocument A (Student Transcript - extract courses from here):\n${args.textA}\n\nDocument B (Course of Study - use descriptions from here to enhance extracted courses):\n${args.textB}`;

    const generationConfig: any = {
      temperature: 0,
      responseMimeType: "application/json",
    };

    const response = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "user", parts: [{ text: userContent }] },
      ],
      generationConfig,
    } as any);

    const text = (response as any).response?.text?.() || (response as any).response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    console.log("[Gemini] Raw response text:", text.slice(0, 500) + "...");
    
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error("[Gemini] JSON parse error:", e);
      console.error("[Gemini] Problematic text around position 451:", text.slice(440, 460));
      
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end !== -1) {
        const jsonText = text.slice(start, end + 1);
        console.log("[Gemini] Attempting fallback parse with text:", jsonText.slice(0, 200) + "...");
        try {
          parsed = JSON.parse(jsonText);
        } catch (fallbackError) {
          console.error("[Gemini] Fallback parse also failed:", fallbackError);
          console.error("[Gemini] Full response text:", text);
          const originalErrorMsg = e instanceof Error ? e.message : String(e);
          const fallbackErrorMsg = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`Gemini response was not valid JSON. Original error: ${originalErrorMsg}. Fallback error: ${fallbackErrorMsg}`);
        }
      } else {
        console.error("[Gemini] No JSON structure found in response");
        throw new Error("Gemini response was not valid JSON - no JSON structure found");
      }
    }
    return parsed;
  },
});

export const geminiProcessDualPDFs = action({
  args: { dualTranscriptId: v.id("dualTranscripts") },
  handler: async (ctx, args) => {
    console.log("[Gemini] Start processing", args.dualTranscriptId);
    await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptStatus, {
      dualTranscriptId: args.dualTranscriptId,
      status: "processing",
    });

    try {
      const dualTranscript = await ctx.runQuery(internal.dualTranscripts.getDualTranscriptById, {
        dualTranscriptId: args.dualTranscriptId,
      });
      if (!dualTranscript) throw new Error("Dual transcript not found");
      if (!dualTranscript.transcriptText || !dualTranscript.courseOfStudyText) {
        throw new Error("Missing extracted text from PDFs");
      }

      console.log("[Gemini] Text sizes", {
        transcript: dualTranscript.transcriptText.length,
        courseOfStudy: dualTranscript.courseOfStudyText.length,
        minGrade: dualTranscript.gradeThreshold,
      });

      const raw = await ctx.runAction(api.analysis.geminiDualMatch, {
        textA: dualTranscript.transcriptText,
        textB: dualTranscript.courseOfStudyText,
        minGrade: dualTranscript.gradeThreshold,
      } as any);
      console.log("[Gemini] Raw response received");
      console.log("[Gemini] Sample raw response:", JSON.stringify(raw, null, 2).slice(0, 500) + "...");

      // Normalize Gemini output to match validator schema
      const geminiResults = (() => {
        // If the model returned an array, assume it's the matches array
        if (Array.isArray(raw)) {
          const matches = raw.map((m: any) => {
            // Extract credits from various possible fields
            const credits = m.credits ?? m.units ?? m.hours ?? m.creditHours;
            const creditsNum = typeof credits === 'number' ? credits : 
                              typeof credits === 'string' ? parseFloat(credits) : undefined;
            
            // Debug credit extraction
            if (creditsNum !== undefined) {
              console.log(`[Gemini] Extracted credits for ${m.courseName}: ${creditsNum} (from: ${credits})`);
            } else {
              console.log(`[Gemini] No credits found for ${m.courseName} (checked: ${JSON.stringify({credits: m.credits, units: m.units, hours: m.hours, creditHours: m.creditHours})})`);
            }
            
            return {
              courseCode: m.courseCode || m.code || "",
              courseName: m.courseName || m.title || "",
              units: creditsNum,
              grade: m.grade ?? null,
              meetsMinGrade: Boolean(m.meetsMinGrade),
              description: m.description || "",
              sourceConfidence: typeof m.sourceConfidence === 'number' ? m.sourceConfidence : 0.0,
              evidence: Array.isArray(m.evidence) ? m.evidence : [],
            };
          });
          return {
            matches,
            unmatched: [],
            stats: {
              minGrade: dualTranscript.gradeThreshold,
              executionMode: "single",
              totalCourses: matches.length,
              matchedCount: matches.length,
              unmatchedCount: 0,
            }
          };
        }
        // If object, coerce fields inside
        const matches = (raw.matches ?? []).map((m: any) => {
          // Extract credits from various possible fields
          const credits = m.credits ?? m.units ?? m.hours ?? m.creditHours;
          const creditsNum = typeof credits === 'number' ? credits : 
                            typeof credits === 'string' ? parseFloat(credits) : undefined;
          
          // Debug credit extraction
          if (creditsNum !== undefined) {
            console.log(`[Gemini] Extracted credits for ${m.courseName}: ${creditsNum} (from: ${credits})`);
          } else {
            console.log(`[Gemini] No credits found for ${m.courseName} (checked: ${JSON.stringify({credits: m.credits, units: m.units, hours: m.hours, creditHours: m.creditHours})})`);
          }
          
          return {
            courseCode: m.courseCode || m.code || "",
            courseName: m.courseName || m.title || "",
            units: creditsNum,
            grade: m.grade ?? null,
            meetsMinGrade: Boolean(m.meetsMinGrade),
            description: m.description || "",
            sourceConfidence: typeof m.sourceConfidence === 'number' ? m.sourceConfidence : 0.0,
            evidence: Array.isArray(m.evidence) ? m.evidence : [],
          };
        });
        const unmatched = Array.isArray(raw.unmatched) ? raw.unmatched.map((u: any) => ({
          courseCode: u.courseCode || u.code || "",
          courseName: u.courseName || u.title || "",
          reason: u.reason || "not_matched",
        })) : [];
        const stats = raw.stats || {};
        return {
          matches,
          unmatched,
          stats: {
            minGrade: stats.minGrade || dualTranscript.gradeThreshold,
            executionMode: stats.executionMode || "single",
            totalCourses: stats.totalCourses ?? matches.length,
            matchedCount: stats.matchedCount ?? matches.length,
            unmatchedCount: stats.unmatchedCount ?? unmatched.length,
          }
        };
      })();

      await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptGeminiResults, {
        dualTranscriptId: args.dualTranscriptId,
        geminiResults,
      } as any);
      console.log("[Gemini] Results saved", args.dualTranscriptId);
    } catch (error) {
      console.error("[Gemini] Error", error);
      await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptStatus, {
        dualTranscriptId: args.dualTranscriptId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  },
});

// Analyze transcript using optimized hybrid method (vector + TF-IDF + semantic)
export const analyzeTranscriptHybrid = action({
  args: {
    transcriptId: v.id("userTranscripts"),
    targetSemester: v.number(),
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      userCourseId?: Doc<"userCourses">["_id"];
      userCourseTitle: string;
      plakshaCourseCode: string;
      plakshaCourseTitle: string;
      similarity: number;
    }>;
    gapCourses: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
    }>;
    futureChallenges: Array<{
      code: string;
      title: string;
      department: string;
      semester: number;
      difficulty: string;
      reason: string;
    }>;
    totalUserCourses: number;
    totalMatched: number;
    totalGaps: number;
    targetSemester: number;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get transcript
    const transcript: Doc<"userTranscripts"> | null = await ctx.runQuery(internal.transcriptData.getTranscriptById, {
      transcriptId: args.transcriptId,
    });

    if (!transcript || transcript.userId !== userId) {
      throw new Error("Transcript not found or unauthorized");
    }

    if (!transcript.parsedCourses) {
      throw new Error("Transcript not processed yet");
    }

    // Get Plaksha courses and core requirements
    const plakshaCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getPlakshaCourses);
    const coreRequirements: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoreRequirementsBySemester, {
      maxSemester: args.targetSemester - 1
    });
    const futureCourses: Doc<"plakshaCourses">[] = await ctx.runQuery(api.courses.getCoursesBySemester, {
      semester: args.targetSemester
    });

    const matchedCourses: Array<{
      userCourseId?: Doc<"userCourses">["_id"];
      userCourseTitle: string;
      plakshaCourseCode: string;
      plakshaCourseTitle: string;
      similarity: number;
    }> = [];
    const matchedPlakshaCodes = new Set<string>();

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

    // OPTIMIZATION: Process all user courses together
    console.log(`[Hybrid Analysis] Processing ${transcript.parsedCourses.length} user courses against ${plakshaCourses.length} Plaksha courses`);

    // Step 1: Generate embeddings for all user courses at once
    const userEmbeddings = await Promise.all(
      transcript.parsedCourses.map(async (course) => ({
        course,
        embedding: await getCachedEmbedding(course.description)
      }))
    );

    // Step 2: For each user course, get top candidates using vector search
    const allComparisons: Array<{
      userCourse: any;
      plakshaCourse: Doc<"plakshaCourses">;
      vectorScore: number;
      tfidfScore: number;
    }> = [];

    for (const { course: userCourse, embedding: userEmbedding } of userEmbeddings) {
      if (!userEmbedding || userEmbedding.length === 0) {
        console.warn(`[Hybrid Analysis] Skipping course due to empty embedding: ${userCourse.title}`);
        continue;
      }

      // Use vector search to get top 10 candidates (instead of processing all courses)
      const searchResults = await ctx.vectorSearch("plakshaCourses", "by_embedding", {
        vector: userEmbedding,
        limit: 10, // Get more candidates for better coverage
      });

      // Process only the top candidates
      for (const result of searchResults) {
        if (result._score > 0.4) { // Lower threshold for initial filtering
          const plakshaCourse = plakshaCourses.find(c => c._id === result._id);
          if (plakshaCourse) {
            // Calculate TF-IDF score
            const tfidfA = getTfidfVec(userCourse.description, 'user:' + hashText(userCourse.description));
            const tfidfB = getTfidfVec(plakshaCourse.description, 'plaksha:' + plakshaCourse.code);
            const tfidfScore = cosineSim(tfidfA, tfidfB);

            allComparisons.push({
              userCourse,
              plakshaCourse,
              vectorScore: result._score,
              tfidfScore
            });
          }
        }
      }
    }

    // Step 3: Batch AI similarity calls for all remaining comparisons
    console.log(`[Hybrid Analysis] Computing AI similarity for ${allComparisons.length} course pairs`);
    
    const BATCH_SIZE = 10; // Larger batch size for efficiency
    const allResults: Array<{
      userCourse: any;
      plakshaCourse: Doc<"plakshaCourses">;
      vectorScore: number;
      tfidfScore: number;
      semanticScore: number;
      finalScore: number;
    }> = [];

    for (let i = 0; i < allComparisons.length; i += BATCH_SIZE) {
      const batch = allComparisons.slice(i, i + BATCH_SIZE);
      
      // Process batch in parallel
      const batchResults = await Promise.all(batch.map(async ({ userCourse, plakshaCourse, vectorScore, tfidfScore }) => {
        let semanticScore = 0;
        try {
          semanticScore = await getCachedSimilarity(userCourse.description, plakshaCourse.description);
        } catch (e) {
          semanticScore = 0;
        }

        // Weighted sum: 0.4 * vector + 0.3 * tfidf + 0.3 * semantic
        const finalScore = 0.4 * vectorScore + 0.3 * tfidfScore + 0.3 * semanticScore;

        return {
          userCourse,
          plakshaCourse,
          vectorScore,
          tfidfScore,
          semanticScore,
          finalScore
        };
      }));

      allResults.push(...batchResults);

      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < allComparisons.length) {
        await sleep(100); // Reduced delay since we're processing fewer comparisons
      }
    }

    // Step 4: Find best matches for each user course
    const userCourseMatches = new Map<string, {
      plakshaCourse: Doc<"plakshaCourses">;
      finalScore: number;
    }>();

    for (const result of allResults) {
      const userCourseKey = result.userCourse.title;
      const currentBest = userCourseMatches.get(userCourseKey);
      
      if (!currentBest || result.finalScore > currentBest.finalScore) {
        if (result.finalScore > 0.4) { // Final threshold
          userCourseMatches.set(userCourseKey, {
            plakshaCourse: result.plakshaCourse,
            finalScore: result.finalScore
          });
        }
      }
    }

    // Step 5: Build final results
    for (const [userCourseTitle, match] of userCourseMatches) {
      const userCourse = transcript.parsedCourses.find(c => c.title === userCourseTitle);
      if (userCourse) {
        matchedCourses.push({
          userCourseId: undefined,
          userCourseTitle: userCourse.title,
          plakshaCourseCode: match.plakshaCourse.code,
          plakshaCourseTitle: match.plakshaCourse.title,
          similarity: match.finalScore,
        });
        matchedPlakshaCodes.add(match.plakshaCourse.code);
      }
    }

    // Identify gap courses (core requirements not matched)
    const gapCourses = coreRequirements
      .filter((course: Doc<"plakshaCourses">) => !matchedPlakshaCodes.has(course.code))
      .map((course: Doc<"plakshaCourses">) => ({
        code: course.code,
        title: course.title,
        department: course.department,
        semester: course.semester || 0,
      }));

    // Convert parsed courses to user course format for future analysis
    const userCoursesForAnalysis = transcript.parsedCourses.map((course: any) => ({
      _id: "" as any,
      userId: userId,
      title: course.title,
      description: course.description,
      credits: course.credits,
      _creationTime: Date.now(),
    }));

    // Analyze future course difficulty
    const futureChallenges = await analyzeFutureCourses(userCoursesForAnalysis, futureCourses);

    // Save analysis result
    await ctx.runMutation(internal.analysis.saveAnalysisResult, {
      userId,
      transcriptId: args.transcriptId,
      matchedCourses,
      gapCourses,
      futureChallenges,
      analysisDate: Date.now(),
      targetSemester: args.targetSemester,
      analysisType: "transcript-hybrid",
    });

    return {
      matchedCourses,
      gapCourses,
      futureChallenges,
      totalUserCourses: transcript.parsedCourses.length,
      totalMatched: matchedCourses.length,
      totalGaps: gapCourses.length,
      targetSemester: args.targetSemester
    };
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
  
  // For Azure OpenAI, the model name in the request should match the deployment name
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

// Analyze future course difficulty based on user's background
async function analyzeFutureCourses(
  userCourses: Array<{ title: string; description: string }>,
  futureCourses: Doc<"plakshaCourses">[]
): Promise<Array<{
  code: string;
  title: string;
  department: string;
  semester: number;
  difficulty: string;
  reason: string;
}>> {
  const userBackground = userCourses.map(course => 
    `${course.title}: ${course.description}`
  ).join('\n\n');

  const challenges = [];

  for (const futureCourse of futureCourses) {
    try {
      const prompt = `
Based on the student's academic background, assess the difficulty level of this upcoming course and provide reasoning.

Student's Background:
${userBackground}

Upcoming Course:
${futureCourse.code}: ${futureCourse.title}
Description: ${futureCourse.description}

Assess the difficulty level as one of: "Easy", "Moderate", "Challenging", "Very Challenging"

Provide your response in this exact format:
Difficulty: [difficulty level]
Reason: [brief explanation of why this course would be at this difficulty level for this student]`;

      const response = await openai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content?.trim() || "";
      const difficultyMatch = content.match(/Difficulty:\s*(.+)/);
      const reasonMatch = content.match(/Reason:\s*(.+)/);

      const difficulty = difficultyMatch?.[1]?.trim() || "Moderate";
      const reason = reasonMatch?.[1]?.trim() || "Assessment not available";

      challenges.push({
        code: futureCourse.code,
        title: futureCourse.title,
        department: futureCourse.department,
        semester: futureCourse.semester || 0,
        difficulty,
        reason,
      });
    } catch (error) {
      console.error(`Error analyzing future course ${futureCourse.code}:`, error);
      challenges.push({
        code: futureCourse.code,
        title: futureCourse.title,
        department: futureCourse.department,
        semester: futureCourse.semester || 0,
        difficulty: "Moderate",
        reason: "Unable to assess difficulty",
      });
    }
  }

  return challenges;
}

// Extract curriculum courses from course of study document
export const extractCurriculumCourses = action({
  args: {
    courseOfStudyText: v.string(),
  },
  handler: async (_ctx, args): Promise<{
    courses: Array<{
      code: string;
      title: string;
      description: string;
      credits?: number;
      semester?: number;
      isCoreRequirement?: boolean;
    }>;
  }> => {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_API_KEY not configured");

    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `You are a curriculum extraction assistant. Extract all courses from the provided course of study document and return them as a structured JSON array. Each course should have:
- code: Course code (e.g., "CS101", "MATH201")
- title: Full course title
- description: Detailed course description
- credits: Number of credits (if mentioned)
- semester: Semester number (if mentioned)
- isCoreRequirement: true if it's a required/core course, false if elective

Return only valid JSON in this exact format:
{
  "courses": [
    {
      "code": "CS101",
      "title": "Introduction to Computer Science",
      "description": "Fundamental concepts of computer science...",
      "credits": 3,
      "semester": 1,
      "isCoreRequirement": true
    }
  ]
}`;

    const userContent = `Extract all courses from this course of study document:\n\n${args.courseOfStudyText}`;

    const generationConfig: any = {
      temperature: 0,
      responseMimeType: "application/json",
    };

    try {
      const response = await model.generateContent({
        contents: [
          { role: "user", parts: [{ text: systemPrompt }] },
          { role: "user", parts: [{ text: userContent }] },
        ],
        generationConfig,
      } as any);

      const text = (response as any).response?.text?.() || (response as any).response?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (e) {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          parsed = JSON.parse(text.slice(start, end + 1));
        } else {
          throw new Error("Gemini response was not valid JSON");
        }
      }

      return {
        courses: parsed.courses || [],
      };
    } catch (error) {
      console.error("Error extracting curriculum courses:", error);
      return { courses: [] };
    }
  },
});

// Extract credits from course text using regex patterns
function extractCreditsFromText(courseText: string): number | undefined {
  // Common credit patterns
  const patterns = [
    /(\d+(?:\.\d+)?)\s*(?:credits?|hours?|units?|ch)\b/i,
    /\b(\d+(?:\.\d+)?)\b(?=.*(?:credit|hour|unit))/i,
    /credit[:\s]*(\d+(?:\.\d+)?)/i,
    /hour[:\s]*(\d+(?:\.\d+)?)/i,
    /unit[:\s]*(\d+(?:\.\d+)?)/i,
  ];
  
  for (const pattern of patterns) {
    const match = courseText.match(pattern);
    if (match) {
      const credits = parseFloat(match[1]);
      if (credits >= 1 && credits <= 6) { // Reasonable credit range
        return credits;
      }
    }
  }
  
  return undefined;
}

// Utility: sleep for ms milliseconds
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Save analysis result (internal)
export const saveAnalysisResult = internalMutation({
  args: {
    userId: v.id("users"),
    transcriptId: v.optional(v.id("userTranscripts")),
    matchedCourses: v.array(v.object({
      userCourseId: v.optional(v.id("userCourses")),
      userCourseTitle: v.string(),
      plakshaCourseCode: v.string(),
      plakshaCourseTitle: v.string(),
      similarity: v.number(),
    })),
    gapCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      department: v.string(),
      semester: v.number(),
    })),
    futureChallenges: v.array(v.object({
      code: v.string(),
      title: v.string(),
      department: v.string(),
      semester: v.number(),
      difficulty: v.string(),
      reason: v.string(),
    })),
    analysisDate: v.number(),
    targetSemester: v.number(),
    analysisType: v.union(
      v.literal("manual"),
      v.literal("transcript"),
      v.literal("transcript-manual"),
      v.literal("transcript-hybrid")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("analysisResults", args);
  },
});

// Get latest analysis result
export const getLatestAnalysis = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const results = await ctx.db
      .query("analysisResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(1);

    return results[0] || null;
  },
});
