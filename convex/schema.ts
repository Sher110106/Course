import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // User's completed courses
  userCourses: defineTable({
    userId: v.id("users"),
    title: v.string(),
    description: v.string(),
    institution: v.optional(v.string()),
    credits: v.optional(v.number()),
  }).index("by_user", ["userId"]),

  // User's uploaded transcripts
  userTranscripts: defineTable({
    userId: v.id("users"),
    fileName: v.string(),
    fileId: v.id("_storage"),
    extractedText: v.optional(v.string()),
    parsedCourses: v.optional(v.array(v.object({
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
    }))),
    processingStatus: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    uploadDate: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["processingStatus"]),

  // NEW: Dual PDF processing for curriculum gap analysis
  dualTranscripts: defineTable({
    userId: v.id("users"),
    transcriptFileId: v.id("_storage"),
    courseOfStudyFileId: v.id("_storage"),
    transcriptFileName: v.string(),
    courseOfStudyFileName: v.string(),
    transcriptText: v.optional(v.string()),
    courseOfStudyText: v.optional(v.string()),
    processingStatus: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    gradeThreshold: v.string(), // e.g., "B", "C+", etc.
    extractedCourses: v.optional(v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
      code: v.optional(v.string()),
    }))),
    curriculumCourses: v.optional(v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
      isRequired: v.boolean(),
      semester: v.optional(v.number()),
    }))),
    analysisResults: v.optional(v.object({
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
    })),
    errorMessage: v.optional(v.string()),
    uploadDate: v.number(),
  }).index("by_user", ["userId"])
    .index("by_status", ["processingStatus"]),

  // Plaksha University curriculum (predefined) with vector embeddings
  plakshaCourses: defineTable({
    code: v.string(),
    title: v.string(),
    description: v.string(),
    credits: v.number(),
    isCoreRequirement: v.boolean(),
    department: v.string(),
    semester: v.optional(v.number()),
    embedding: v.optional(v.array(v.number())),
  }).index("by_core", ["isCoreRequirement"])
    .index("by_department", ["department"])
    .index("by_semester", ["semester"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072,
    }),

  // Analysis results
  analysisResults: defineTable({
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
    analysisType: v.optional(v.union(
      v.literal("manual"),
      v.literal("transcript"),
      v.literal("transcript-manual"),
      v.literal("transcript-hybrid")
    )),
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
