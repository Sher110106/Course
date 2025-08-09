import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

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
    await ctx.scheduler.runAfter(0, internal.dualTranscripts.processDualPDFs, {
      dualTranscriptId,
    });

    return dualTranscriptId;
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

    // Delete the files from storage
    await ctx.storage.delete(dualTranscript.transcriptFileId);
    await ctx.storage.delete(dualTranscript.courseOfStudyFileId);
    
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
export const processDualPDFs = internalMutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
  },
  handler: async (ctx, args) => {
    // Update status to processing
    await ctx.db.patch(args.dualTranscriptId, {
      processingStatus: "processing",
    });

    try {
      const dualTranscript = await ctx.db.get(args.dualTranscriptId);
      if (!dualTranscript) {
        throw new Error("Dual transcript not found");
      }

      if (!dualTranscript.transcriptText || !dualTranscript.courseOfStudyText) {
        throw new Error("Missing extracted text from PDFs");
      }

      // Extract courses from transcript with enhanced multi-pass extraction
      const enhancedExtractedCourses = await ctx.runMutation(internal.enhancedCourseExtraction.extractCoursesWithMultiPass, {
        transcriptText: dualTranscript.transcriptText,
        gradeThreshold: dualTranscript.gradeThreshold,
        institution: "plaksha", // Use Plaksha-specific configuration
      });

      // Transform enhanced extraction results to match the expected schema format
      const extractedCourses = enhancedExtractedCourses.map(course => ({
        title: course.title,
        description: course.description,
        grade: course.grade,
        credits: course.credits,
        semester: course.semester,
        code: course.code,
        confidence: course.confidence,
        extractionMethod: course.extractionMethod,
      }));

      // Extract curriculum courses from course of study
      const curriculumCourses = await ctx.runMutation(internal.courseExtraction.extractCurriculumCourses, {
        courseOfStudyText: dualTranscript.courseOfStudyText,
      });

      // Log the course of study text format for debugging
      await ctx.runMutation(internal.courseExtraction.logCourseOfStudyText, {
        courseOfStudyText: dualTranscript.courseOfStudyText,
      });

      // NEW: Match transcript courses to course of study courses and enhance descriptions
      console.log(`[Dual Processing] Starting course matching for ${extractedCourses.length} transcript courses against ${curriculumCourses.length} course of study courses`);
      
      const matchingResults = await ctx.runMutation(internal.courseMatching.matchTranscriptToCourseOfStudy, {
        transcriptCourses: extractedCourses,
        courseOfStudyCourses: curriculumCourses,
        matchingThreshold: 0.25, // Lower threshold to handle OCR errors
      });

      // Use matched courses with enhanced descriptions from course of study
      const enhancedCourses = matchingResults.matchedCourses;
      
      console.log(`[Dual Processing] Course matching complete:`, {
        originalCourses: extractedCourses.length,
        matchedCourses: enhancedCourses.length,
        unmatchedCourses: matchingResults.unmatchedCourses.length,
        matchingRate: matchingResults.matchingStats.matchingRate,
      });

      // Log unmatched courses for debugging
      if (matchingResults.unmatchedCourses.length > 0) {
        console.log(`[Dual Processing] Unmatched courses:`);
        matchingResults.unmatchedCourses.forEach((unmatched, i) => {
          console.log(`  ${i + 1}. "${unmatched.title}" - ${unmatched.reason}`);
          if (unmatched.bestMatch) {
            console.log(`     Best match: "${unmatched.bestMatch.courseOfStudyTitle}" (${(unmatched.bestMatch.similarity * 100).toFixed(1)}%)`);
          }
        });
      }

      // Log description enhancements for debugging
      if (enhancedCourses.length > 0) {
        console.log(`[Dual Processing] Sample description enhancements:`);
        enhancedCourses.slice(0, 3).forEach((course, i) => {
          console.log(`  ${i + 1}. "${course.title}"`);
          console.log(`     Original: "${course.courseOfStudyMatch.originalTranscriptDescription.slice(0, 80)}..."`);
          console.log(`     Enhanced: "${course.description.slice(0, 80)}..."`);
          console.log(`     Match: "${course.courseOfStudyMatch.courseOfStudyTitle}" (${course.courseOfStudyMatch.matchType}, ${(course.courseOfStudyMatch.matchScore * 100).toFixed(1)}%)`);
        });
      }

      // Update the dual transcript with enhanced courses (now with course of study descriptions)
      await ctx.db.patch(args.dualTranscriptId, {
        extractedCourses: enhancedCourses, // Use enhanced courses with course of study descriptions
        curriculumCourses,
        processingStatus: "completed",
      });

      console.log(`Processed dual transcript ${args.dualTranscriptId}:`, {
        originalExtractedCourses: extractedCourses.length,
        enhancedCourses: enhancedCourses.length,
        curriculumCourses: curriculumCourses.length,
        gradeThreshold: dualTranscript.gradeThreshold,
        matchingRate: matchingResults.matchingStats.matchingRate,
      });

    } catch (error) {
      console.error("Error processing dual PDFs:", error);
      await ctx.db.patch(args.dualTranscriptId, {
        processingStatus: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
}); 