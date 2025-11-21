import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
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

function hashText(text: string): string {
  return text.toLowerCase().replace(/\W+/g, '').slice(0, 128);
}
function hashPair(a: string, b: string): string {
  return hashText(a) + '||' + hashText(b);
}

// ---- Caching wrappers ----
async function _getCachedEmbedding(text: string): Promise<number[]> {
  const key = hashText(text);
  if (embeddingCache.has(key)) return embeddingCache.get(key)!;
  const emb = await generateEmbedding(text);
  embeddingCache.set(key, emb);
  return emb;
}
async function _getCachedSimilarity(a: string, b: string): Promise<number> {
  const key = hashPair(a, b);
  if (similarityCache.has(key)) return similarityCache.get(key)!;
  const sim = await calculateCourseSimilarity(a, b);
  similarityCache.set(key, sim);
  return sim;
}

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

// Gemini AI integration for dual PDF processing
export const geminiDualMatch = action({
  args: {
    textA: v.string(),
    textB: v.string(),
    minGrade: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("[Gemini] Starting dual match with minGrade:", args.minGrade);
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || "dummy-key");
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
      const prompt = `
You are an expert academic transcript analyzer. Your task is to extract and match courses from a student transcript against a course of study document.

STUDENT TRANSCRIPT:
${args.textA}

COURSE OF STUDY DOCUMENT:
${args.textB}

MINIMUM GRADE THRESHOLD: ${args.minGrade}

Grade Scale (from highest to lowest):
A+, A, A-, B+, B, B-, C+, C, C-, D+, D, D-, F

Instructions:
1. Extract ALL courses from the student transcript regardless of grade
2. For each course, try to match it with a corresponding course from the course of study document
3. Extract course details including: course code, course name, units/credits, grade, and description
4. Evaluate if each course meets the minimum grade threshold and set the meetsMinGrade flag accordingly
5. For courses that couldn't be matched with the course of study document, provide a reason in the unmatched array

Return your response as a JSON object with this exact structure:
{
  "matches": [
    {
      "courseCode": "string",
      "courseName": "string", 
      "units": number,
      "grade": "string",
      "meetsMinGrade": boolean,
      "description": "string",
      "sourceConfidence": number,
      "evidence": ["string"]
    }
  ],
  "unmatched": [
    {
      "courseCode": "string",
      "courseName": "string",
      "reason": "string"
    }
  ],
  "stats": {
    "minGrade": "${args.minGrade}",
    "executionMode": "dual_pdf_analysis",
    "totalCourses": number,
    "matchedCount": number,
    "unmatchedCount": number
  }
}

Important:
- Extract ALL courses from the transcript, not just those meeting the grade threshold
- The backend will filter based on meetsMinGrade flag later
- Set meetsMinGrade to true if the course grade meets or exceeds the threshold (e.g., if threshold is "B", then B, B+, A-, A, A+ should be true; B-, C+, etc. should be false)
- Be thorough in extracting course information from BOTH documents
- Provide detailed descriptions for matched courses by combining information from both documents
- Include evidence for why courses were matched
- Use "unmatched" only for courses that exist in one document but not the other, NOT for grade filtering
`;

    try {
      const result = await model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log("[Gemini] Raw response length:", text.length);
      console.log("[Gemini] Raw response preview:", text.slice(0, 200) + "...");
      
      // Parse JSON response
      let parsed;
      try {
        // Try to extract JSON from the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          let jsonText = jsonMatch[0];
          
          // Fix common JSON issues from LLM responses
          // Remove trailing commas before closing brackets/braces
          jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
          // Fix any malformed trailing commas in arrays
          jsonText = jsonText.replace(/,(\s*\])/g, '$1');
          
          parsed = JSON.parse(jsonText);
          console.log("[Gemini] Successfully parsed JSON response");
        } else {
          console.error("[Gemini] No JSON structure found in response");
          throw new Error("Gemini response was not valid JSON - no JSON structure found");
        }
      } catch (parseError) {
        console.error("[Gemini] JSON parse error:", parseError);
        console.error("[Gemini] Raw response:", text);
        throw new Error("Failed to parse Gemini response as JSON");
      }
      
      // Validate the response structure
      if (!parsed.matches || !Array.isArray(parsed.matches)) {
        console.error("[Gemini] Invalid response structure - missing matches array");
        throw new Error("Gemini response missing required matches array");
      }
      
      if (!parsed.stats || typeof parsed.stats !== 'object') {
        console.error("[Gemini] Invalid response structure - missing stats object");
        throw new Error("Gemini response missing required stats object");
      }
      
      console.log("[Gemini] Response validation passed");
      console.log("[Gemini] Matches count:", parsed.matches?.length || 0);
      console.log("[Gemini] Unmatched count:", parsed.unmatched?.length || 0);
      
      return parsed;
    } catch (error) {
      console.error("[Gemini] Error in dual match:", error);
      throw error;
    }
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
      });
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
            
            return {
              courseCode: m.courseCode || m.code || "N/A",
              courseName: m.courseName || m.title || m.name || "Unknown Course",
              units: creditsNum,
              grade: m.grade || "N/A",
              meetsMinGrade: Boolean(m.meetsMinGrade),
              description: m.description || m.desc || "No description available",
              sourceConfidence: typeof m.sourceConfidence === 'number' ? m.sourceConfidence : 0.8,
              evidence: Array.isArray(m.evidence) ? m.evidence : []
            };
          });
          
          return {
            matches,
            unmatched: [],
            stats: {
              minGrade: dualTranscript.gradeThreshold,
              executionMode: "dual_pdf_analysis",
              totalCourses: matches.length,
              matchedCount: matches.length,
              unmatchedCount: 0
            }
          };
        }
        
        // If the model returned an object, use it directly
        if (raw && typeof raw === 'object') {
          const matches = (raw.matches || []).map((m: any) => {
            // Extract credits from various possible fields
            const credits = m.credits ?? m.units ?? m.hours ?? m.creditHours;
            const creditsNum = typeof credits === 'number' ? credits : 
                              typeof credits === 'string' ? parseFloat(credits) : undefined;

      return {
              courseCode: m.courseCode || m.code || "N/A",
              courseName: m.courseName || m.title || m.name || "Unknown Course",
              units: creditsNum,
              grade: m.grade || "N/A",
              meetsMinGrade: Boolean(m.meetsMinGrade),
              description: m.description || m.desc || "No description available",
              sourceConfidence: typeof m.sourceConfidence === 'number' ? m.sourceConfidence : 0.8,
              evidence: Array.isArray(m.evidence) ? m.evidence : []
            };
          });
          
          return {
            matches,
            unmatched: raw.unmatched || [],
            stats: {
              minGrade: dualTranscript.gradeThreshold,
              executionMode: "dual_pdf_analysis",
              totalCourses: matches.length + (raw.unmatched?.length || 0),
              matchedCount: matches.length,
              unmatchedCount: raw.unmatched?.length || 0
            }
          };
        }
        
        // Fallback: create empty result
        console.warn("[Gemini] Unexpected response format, creating empty result");
        return {
          matches: [],
          unmatched: [],
          stats: {
            minGrade: dualTranscript.gradeThreshold,
            executionMode: "dual_pdf_analysis",
            totalCourses: 0,
            matchedCount: 0,
            unmatchedCount: 0
          }
        };
      })();

      console.log("[Gemini] Normalized results:", {
        matches: geminiResults.matches.length,
        unmatched: geminiResults.unmatched.length,
        stats: geminiResults.stats
      });

      // Update the dual transcript with Gemini results
      await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptGeminiResults, {
        dualTranscriptId: args.dualTranscriptId,
        geminiResults,
      });

      console.log("[Gemini] Successfully processed dual PDFs");
    } catch (error) {
      console.error("[Gemini] Error processing dual PDFs:", error);
      await ctx.runMutation(internal.dualTranscripts.updateDualTranscriptStatus, {
        dualTranscriptId: args.dualTranscriptId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
      });
      throw error;
    }
  },
});
