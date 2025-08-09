import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Clean up old dual transcripts that might have verification data instead of courseOfStudyMatch data
export const cleanupOldDualTranscripts = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get all user's dual transcripts
    const dualTranscripts = await ctx.db
      .query("dualTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let cleanedCount = 0;

    for (const transcript of dualTranscripts) {
      if (transcript.extractedCourses) {
        // Check if any course has the old verification field but not the new courseOfStudyMatch field
        const hasOldData = transcript.extractedCourses.some(course => 
          (course as any).verification && !(course as any).courseOfStudyMatch
        );

        if (hasOldData) {
          // Remove the old verification field from all courses
          const cleanedCourses = transcript.extractedCourses.map(course => {
            const cleanedCourse = { ...course };
            delete (cleanedCourse as any).verification;
            return cleanedCourse;
          });

          // Update the transcript with cleaned courses
          await ctx.db.patch(transcript._id, {
            extractedCourses: cleanedCourses,
            processingStatus: "uploaded", // Reset to uploaded so it can be reprocessed with new system
          });

          cleanedCount++;
        }
      }
    }

    return {
      message: `Cleaned up ${cleanedCount} dual transcripts. They will be reprocessed with the new course matching system.`,
      cleanedCount,
    };
  },
});

// Reset a specific dual transcript to be reprocessed with the new system
export const resetDualTranscriptForReprocessing = mutation({
  args: {
    dualTranscriptId: v.id("dualTranscripts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transcript = await ctx.db.get(args.dualTranscriptId);
    if (!transcript || transcript.userId !== userId) {
      throw new Error("Transcript not found or unauthorized");
    }

    // Reset the transcript to be reprocessed
    await ctx.db.patch(args.dualTranscriptId, {
      extractedCourses: undefined,
      curriculumCourses: undefined,
      analysisResults: undefined,
      processingStatus: "uploaded",
      errorMessage: undefined,
    });

    return {
      message: "Dual transcript reset successfully. It will be reprocessed with the new course matching system.",
    };
  },
});

// Get information about dual transcripts that need migration
export const getDualTranscriptMigrationInfo = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const dualTranscripts = await ctx.db
      .query("dualTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    let oldSystemCount = 0;
    let newSystemCount = 0;
    let needsCleanupCount = 0;

    for (const transcript of dualTranscripts) {
      if (transcript.extractedCourses) {
        const hasOldVerification = transcript.extractedCourses.some(course => 
          (course as any).verification
        );
        const hasNewMatching = transcript.extractedCourses.some(course => 
          (course as any).courseOfStudyMatch
        );

        if (hasOldVerification && !hasNewMatching) {
          oldSystemCount++;
          needsCleanupCount++;
        } else if (hasNewMatching) {
          newSystemCount++;
        }
      }
    }

    return {
      total: dualTranscripts.length,
      oldSystemCount,
      newSystemCount,
      needsCleanupCount,
      message: needsCleanupCount > 0 
        ? `${needsCleanupCount} transcripts need cleanup to use the new course matching system.`
        : "All transcripts are compatible with the new system.",
    };
  },
});
