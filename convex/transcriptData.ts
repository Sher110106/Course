import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Generate upload URL for PDF
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

// Save transcript record and trigger processing
export const saveTranscript = mutation({
  args: {
    fileName: v.string(),
    fileId: v.id("_storage"),
    extractedText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transcriptId = await ctx.db.insert("userTranscripts", {
      userId,
      fileName: args.fileName,
      fileId: args.fileId,
      extractedText: args.extractedText,
      processingStatus: "uploaded",
      uploadDate: Date.now(),
    });

    // Schedule PDF processing
    await ctx.scheduler.runAfter(0, internal.transcripts.processPDF, {
      transcriptId,
    });

    return transcriptId;
  },
});

// Get user's transcripts
export const getUserTranscripts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("userTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Delete transcript
export const deleteTranscript = mutation({
  args: { id: v.id("userTranscripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const transcript = await ctx.db.get(args.id);
    if (!transcript || transcript.userId !== userId) {
      throw new Error("Transcript not found or unauthorized");
    }

    // Delete the file from storage
    await ctx.storage.delete(transcript.fileId);
    
    // Delete the transcript record
    await ctx.db.delete(args.id);
  },
});

// Internal mutation to update transcript status
export const updateTranscriptStatus = internalMutation({
  args: {
    transcriptId: v.id("userTranscripts"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptId, {
      processingStatus: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

// Internal mutation to update transcript data
export const updateTranscriptData = internalMutation({
  args: {
    transcriptId: v.id("userTranscripts"),
    extractedText: v.string(),
    parsedCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
    })),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.transcriptId, {
      extractedText: args.extractedText,
      parsedCourses: args.parsedCourses,
      processingStatus: args.status,
    });
  },
});

// Internal query to get transcript by ID
export const getTranscriptById = internalQuery({
  args: {
    transcriptId: v.id("userTranscripts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transcriptId);
  },
});
