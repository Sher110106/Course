import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal, api } from "./_generated/api";

// Grade value mapping for comparison
const GRADE_VALUES = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0, 'P': 4.0, 'U': 0.0, 'I': 0.0, 'W': 0.0
} as const;

// Helper function to get grade value
function getGradeValue(grade: string): number {
  if (!grade) return 0;
  
  // Handle special cases
  const normalizedGrade = grade.trim().toUpperCase();
  if (normalizedGrade === 'N/A' || normalizedGrade === 'NA' || normalizedGrade === 'NOT AVAILABLE') {
    return 0; // Below threshold
  }
  
  return GRADE_VALUES[normalizedGrade as keyof typeof GRADE_VALUES] || 0;
}

// Generate upload URL for dual PDFs
export const generateDualUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

// Save dual transcript record and trigger processing
export const saveDualTranscript = mutation({
  args: {
    transcriptFileName: v.string(),
    transcriptFileId: v.id("_storage"),
    courseOfStudyFileName: v.string(),
    courseOfStudyFileId: v.id("_storage"),
    transcriptText: v.optional(v.string()),
    courseOfStudyText: v.optional(v.string()),
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const dualTranscriptId = await ctx.db.insert("dualTranscripts", {
      userId,
      transcriptFileName: args.transcriptFileName,
      transcriptFileId: args.transcriptFileId,
      courseOfStudyFileName: args.courseOfStudyFileName,
      courseOfStudyFileId: args.courseOfStudyFileId,
      transcriptText: args.transcriptText,
      courseOfStudyText: args.courseOfStudyText,
      gradeThreshold: args.gradeThreshold,
      processingStatus: "uploaded",
      uploadDate: Date.now(),
    });

    // Schedule dual PDF processing
    console.log("[Dual] Scheduled Gemini processing for", dualTranscriptId);
    await ctx.scheduler.runAfter(0, api.analysis.geminiProcessDualPDFs, { dualTranscriptId } as any);

    return dualTranscriptId;
  },
});

// NEW: Save transcript with COS template reference
export const saveTranscriptWithTemplate = mutation({
  args: {
    transcriptFileName: v.string(),
    transcriptFileId: v.id("_storage"),
    transcriptText: v.string(),
    cosTemplateId: v.optional(v.id("courseOfStudyTemplates")), // Optional: use template
    oneTimeCosText: v.optional(v.string()), // Optional: one-time COS
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Determine COS strategy
    let cosContext: any;
    
    if (args.cosTemplateId) {
      // Using saved template
      console.log("[Save] Using COS template:", args.cosTemplateId);
      cosContext = {
        type: "template",
        templateId: args.cosTemplateId,
      };
    } else if (args.oneTimeCosText) {
      // Using one-time COS
      console.log("[Save] Using one-time COS");
      cosContext = {
        type: "one_time",
        text: args.oneTimeCosText,
      };
    } else {
      // No COS provided
      console.log("[Save] No COS context");
      cosContext = {
        type: "none",
      };
    }

    // Note: We're creating a simplified record for template-based processing
    // The actual extraction will use the enhanced pipeline
    const transcriptId = await ctx.db.insert("dualTranscripts", {
      userId,
      transcriptFileName: args.transcriptFileName,
      transcriptFileId: args.transcriptFileId,
      courseOfStudyFileName: args.cosTemplateId ? "Using Template" : "One-time Upload",
      courseOfStudyFileId: args.transcriptFileId, // Placeholder
      transcriptText: args.transcriptText,
      courseOfStudyText: args.oneTimeCosText,
      gradeThreshold: args.gradeThreshold,
      processingStatus: "uploaded",
      uploadDate: Date.now(),
    });

    // Schedule enhanced extraction
    await ctx.scheduler.runAfter(0, api.enhancedExtraction.extractCoursesWithCache, {
      transcriptId: transcriptId,
      transcriptText: args.transcriptText,
      cosContext: cosContext,
      minGrade: args.gradeThreshold,
    } as any);

    return transcriptId;
  },
});

// Get user's dual transcripts
export const getUserDualTranscripts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("dualTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Delete dual transcript
export const deleteDualTranscript = mutation({
  args: { id: v.id("dualTranscripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const dualTranscript = await ctx.db.get(args.id);
    if (!dualTranscript || dualTranscript.userId !== userId) {
      throw new Error("Dual transcript not found or unauthorized");
    }

    // Delete the files from storage (with error handling)
    try {
      await ctx.storage.delete(dualTranscript.transcriptFileId);
    } catch (error) {
      // File already deleted or not found - continue
    }
    
    try {
      await ctx.storage.delete(dualTranscript.courseOfStudyFileId);
    } catch (error) {
      // File already deleted or not found - continue
    }
    
    // Delete the dual transcript record
    await ctx.db.delete(args.id);
  },
});

// Internal mutation to update dual transcript status
export const updateDualTranscriptStatus = internalMutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    console.log("[Dual] Status update", args.dualTranscriptId, "→", args.status, args.errorMessage || "");
    await ctx.db.patch(args.dualTranscriptId, {
      processingStatus: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

// Internal mutation to update dual transcript data
export const updateDualTranscriptData = internalMutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    transcriptText: v.string(),
    courseOfStudyText: v.string(),
    extractedCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
    })),
    curriculumCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
      isRequired: v.boolean(),
      semester: v.optional(v.number()),
    })),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dualTranscriptId, {
      transcriptText: args.transcriptText,
      courseOfStudyText: args.courseOfStudyText,
      extractedCourses: args.extractedCourses,
      curriculumCourses: args.curriculumCourses,
      processingStatus: args.status,
    });
  },
});

// Internal mutation to update dual transcript with analysis results
export const updateDualTranscriptAnalysis = internalMutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    analysisResults: v.object({
      matchedCourses: v.array(v.object({
        userCourse: v.string(),
        curriculumCourse: v.string(),
        similarity: v.number(),
        grade: v.string(),
        // Enhanced fields for detailed matching
        userCourseDescription: v.optional(v.string()),
        curriculumCourseDescription: v.optional(v.string()),
        similarityBreakdown: v.optional(v.object({
          vectorScore: v.number(),
          tfidfScore: v.number(),
          semanticScore: v.number(),
          finalScore: v.number(),
        })),
        matchingHighlights: v.optional(v.object({
          userHighlights: v.array(v.string()),
          curriculumHighlights: v.array(v.string()),
        })),
        userCourseCode: v.optional(v.string()),
        curriculumCourseCode: v.optional(v.string()),
      })),
      gapCourses: v.array(v.object({
        code: v.string(),
        title: v.string(),
        description: v.string(),
        semester: v.optional(v.number()),
        priority: v.union(v.literal("high"), v.literal("medium"), v.literal("low")),
        // Enhanced gap analysis fields
        topics: v.optional(v.array(v.string())),
        hasPrerequisites: v.optional(v.boolean()),
        prerequisiteMet: v.optional(v.boolean()),
        difficultyReason: v.optional(v.string()),
      })),
      recommendations: v.array(v.object({
        type: v.union(v.literal("prerequisite"), v.literal("elective"), v.literal("core")),
        message: v.string(),
        courses: v.array(v.string()),
      })),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.dualTranscriptId, {
      analysisResults: args.analysisResults,
    });
  },
});

// Internal query to get dual transcript by ID
export const getDualTranscriptById = internalQuery({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.dualTranscriptId);
  },
});

// Public query to get dual transcript by ID (for client access)
export const getDualTranscriptByIdPublic = query({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const dualTranscript = await ctx.db.get(args.dualTranscriptId);
    if (!dualTranscript || dualTranscript.userId !== userId) {
      return null;
    }

    return dualTranscript;
  },
});

// Internal action to process dual PDFs with enhanced course extraction
// Internal mutation to update Gemini results atomically
export const updateDualTranscriptGeminiResults = internalMutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
    geminiResults: v.object({
      matches: v.array(v.object({
        courseCode: v.string(),
        courseName: v.string(),
        units: v.optional(v.union(v.number(), v.string())),
        grade: v.optional(v.union(v.string(), v.null() as any)),
        meetsMinGrade: v.boolean(),
        description: v.string(),
        sourceConfidence: v.number(),
        evidence: v.optional(v.array(v.string())),
      })),
      unmatched: v.array(v.object({
        courseCode: v.string(),
        courseName: v.string(),
        reason: v.string(),
      })),
      stats: v.object({
        minGrade: v.string(),
        executionMode: v.string(),
        totalCourses: v.optional(v.number()),
        matchedCount: v.optional(v.number()),
        unmatchedCount: v.optional(v.number()),
      }),
    }),
  },
  handler: async (ctx, args) => {
    // Get the dual transcript to access the grade threshold
    const dualTranscript = await ctx.db.get(args.dualTranscriptId);
    const gradeThreshold = dualTranscript?.gradeThreshold || "B";
    
    // Backfill legacy fields for compatibility (extractedCourses) from Gemini matches
    // Filter courses based on grade threshold first
    const filteredMatches = (args.geminiResults.matches || []).filter((m) => {
      const meetsMinGrade = Boolean(m.meetsMinGrade);
      
      // Handle missing grades explicitly
      let shouldInclude = meetsMinGrade;
      if (!meetsMinGrade) {
        if (m.grade === null || m.grade === undefined || m.grade === '') {
          // Explicitly exclude courses with missing grades
          shouldInclude = false;
          console.log(`[Grade Filter] Excluding course ${m.courseName} - missing grade`);
        } else {
          // Manual grade validation as fallback for courses with grades
          const gradeValue = getGradeValue(m.grade);
          const thresholdValue = getGradeValue(gradeThreshold);
          shouldInclude = gradeValue >= thresholdValue;
          
          if (shouldInclude) {
            console.log(`[Grade Filter] Fallback validation: Course ${m.courseName} with grade ${m.grade} actually meets threshold ${gradeThreshold}`);
          }
        }
      }
      
      console.log(`[Grade Filter] Course ${m.courseName}: grade=${m.grade}, meetsMinGrade=${meetsMinGrade}, shouldInclude=${shouldInclude}`);
      if (!shouldInclude) {
        console.log(`[Grade Filter] Excluding course ${m.courseName} with grade ${m.grade} - does not meet threshold`);
      }
      return shouldInclude;
    });
    
    console.log(`[Grade Filter] Filtered from ${args.geminiResults.matches?.length || 0} to ${filteredMatches.length} courses that meet grade threshold`);
    
    const extractedCourses = filteredMatches.map((m) => {
      // Extract credits from various possible fields
      let credits = m.units ?? (m as any).credits ?? (m as any).hours ?? (m as any).creditHours;
      let creditsNum = typeof credits === 'number' ? credits : 
                      typeof credits === 'string' ? parseFloat(credits) : undefined;
      
      // Fallback: try to extract credits from course description if not found
      if (creditsNum === undefined && m.description) {
        // Import the credit extraction function (we'll need to make it available)
        // For now, use a simple regex pattern
        const creditMatch = m.description.match(/(\d+(?:\.\d+)?)\s*(?:credits?|hours?|units?|ch)\b/i);
        if (creditMatch) {
          creditsNum = parseFloat(creditMatch[1]);
          console.log(`[Credit Fallback] Extracted credits for ${m.courseName}: ${creditsNum} from description`);
        }
      }
      
      return {
        title: m.courseName,
        description: m.description,
        grade: (m as any).grade ?? "",
        credits: creditsNum,
        semester: undefined,
        code: m.courseCode,
        confidence: (m as any).sourceConfidence,
        extractionMethod: "ai" as any,
      };
    });

    await ctx.db.patch(args.dualTranscriptId, {
      geminiResults: args.geminiResults as any,
      extractedCourses,
      processingStatus: "completed",
    });
  },
});