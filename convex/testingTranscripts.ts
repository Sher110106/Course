import { mutation, query, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Generate upload URL for testing PDFs
export const generateTestingUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

// Save testing transcript record and trigger processing
export const saveTestingTranscript = mutation({
  args: {
    transcriptFileName: v.string(),
    transcriptFileId: v.id("_storage"),
    courseOfStudyFileName: v.string(),
    courseOfStudyFileId: v.id("_storage"),
    transcriptText: v.optional(v.string()),
    courseOfStudyText: v.optional(v.string()),
    gradeThreshold: v.string(),
    useAdvancedFeatures: v.optional(v.boolean()), // Whether to use advanced Textract features
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const testingTranscriptId = await ctx.db.insert("testingTranscripts", {
      userId,
      transcriptFileName: args.transcriptFileName,
      transcriptFileId: args.transcriptFileId,
      courseOfStudyFileName: args.courseOfStudyFileName,
      courseOfStudyFileId: args.courseOfStudyFileId,
      transcriptText: args.transcriptText,
      courseOfStudyText: args.courseOfStudyText,
      gradeThreshold: args.gradeThreshold,
      useAdvancedFeatures: args.useAdvancedFeatures ?? false,
      processingStatus: "uploaded",
      uploadDate: Date.now(),
    });

    // Schedule testing PDF processing
    await ctx.scheduler.runAfter(0, internal.testingTranscripts.processTestingPDFs, {
      testingTranscriptId,
    });

    return testingTranscriptId;
  },
});

// Get user's testing transcripts
export const getUserTestingTranscripts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("testingTranscripts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// Delete testing transcript
export const deleteTestingTranscript = mutation({
  args: { id: v.id("testingTranscripts") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const testingTranscript = await ctx.db.get(args.id);
    if (!testingTranscript || testingTranscript.userId !== userId) {
      throw new Error("Testing transcript not found or unauthorized");
    }

    // Delete the files from storage
    await ctx.storage.delete(testingTranscript.transcriptFileId);
    await ctx.storage.delete(testingTranscript.courseOfStudyFileId);
    
    // Delete the testing transcript record
    await ctx.db.delete(args.id);
  },
});

// Internal mutation to update testing transcript status
export const updateTestingTranscriptStatus = internalMutation({
  args: {
    testingTranscriptId: v.id("testingTranscripts"),
    status: v.union(
      v.literal("uploaded"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testingTranscriptId, {
      processingStatus: args.status,
      errorMessage: args.errorMessage,
    });
  },
});

// Internal mutation to update testing transcript data
export const updateTestingTranscriptData = internalMutation({
  args: {
    testingTranscriptId: v.id("testingTranscripts"),
    transcriptText: v.string(),
    courseOfStudyText: v.string(),
    extractedCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
      code: v.optional(v.string()),
      confidence: v.optional(v.number()),
      extractionMethod: v.optional(v.union(v.literal("textract"), v.literal("ai"), v.literal("fuzzy"), v.literal("manual"))),
      courseOfStudyMatch: v.optional(v.object({
        originalTranscriptDescription: v.string(),
        courseOfStudyDescription: v.string(),
        courseOfStudyTitle: v.string(),
        courseOfStudyCode: v.string(),
        matchScore: v.number(),
        matchType: v.union(v.literal("exact_code"), v.literal("exact_title"), v.literal("fuzzy_title"), v.literal("partial_match")),
      })),
    })),
    curriculumCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
      isRequired: v.boolean(),
      semester: v.optional(v.number()),
    })),
    textractResults: v.object({
      transcriptConfidence: v.number(),
      courseOfStudyConfidence: v.number(),
      processingTime: v.number(),
      featuresUsed: v.array(v.string()),
    }),
    status: v.literal("completed"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testingTranscriptId, {
      transcriptText: args.transcriptText,
      courseOfStudyText: args.courseOfStudyText,
      extractedCourses: args.extractedCourses,
      curriculumCourses: args.curriculumCourses,
      textractResults: args.textractResults,
      processingStatus: args.status,
    });
  },
});

// Internal query to get testing transcript by ID
export const getTestingTranscriptById = internalQuery({
  args: {
    testingTranscriptId: v.id("testingTranscripts"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testingTranscriptId);
  },
});

// Public query to get testing transcript by ID (for client access)
export const getTestingTranscriptByIdPublic = query({
  args: {
    testingTranscriptId: v.id("testingTranscripts"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const testingTranscript = await ctx.db.get(args.testingTranscriptId);
    if (!testingTranscript || testingTranscript.userId !== userId) {
      return null;
    }

    return testingTranscript;
  },
});

// Internal action to process testing PDFs with Amazon Textract
export const processTestingPDFs = internalAction({
  args: {
    testingTranscriptId: v.id("testingTranscripts"),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    // Update status to processing
    await ctx.runMutation(internal.testingTranscripts.updateTestingTranscriptStatus, {
      testingTranscriptId: args.testingTranscriptId,
      status: "processing",
    });

    try {
      const testingTranscript = await ctx.runQuery(internal.testingTranscripts.getTestingTranscriptById, {
        testingTranscriptId: args.testingTranscriptId,
      });
      if (!testingTranscript) {
        throw new Error("Testing transcript not found");
      }

      console.log(`[Testing Processing] Starting Amazon Textract processing for transcript ${args.testingTranscriptId}`);

      // Get file URLs from storage
      const transcriptUrl = await ctx.storage.getUrl(testingTranscript.transcriptFileId);
      const courseOfStudyUrl = await ctx.storage.getUrl(testingTranscript.courseOfStudyFileId);

      if (!transcriptUrl || !courseOfStudyUrl) {
        throw new Error("Failed to get file URLs from storage");
      }

      // Extract text using Amazon Textract via separate actions
      let transcriptResult, courseOfStudyResult;
      
      if (testingTranscript.useAdvancedFeatures) {
        console.log(`[Testing Processing] Using advanced Textract features for better extraction`);
        [transcriptResult, courseOfStudyResult] = await Promise.all([
          ctx.runAction(internal.awsTextract.extractTextWithTextract, {
            fileUrl: transcriptUrl,
            features: ["TABLES", "FORMS"]
          }),
          ctx.runAction(internal.awsTextract.extractTextWithTextract, {
            fileUrl: courseOfStudyUrl,
            features: ["TABLES", "FORMS"]
          }),
        ]);
      } else {
        console.log(`[Testing Processing] Using simple Textract detection for faster processing`);
        [transcriptResult, courseOfStudyResult] = await Promise.all([
          ctx.runAction(internal.awsTextract.detectDocumentText, {
            fileUrl: transcriptUrl
          }),
          ctx.runAction(internal.awsTextract.detectDocumentText, {
            fileUrl: courseOfStudyUrl
          }),
        ]);
      }

      // Check for extraction errors
      if (transcriptResult.error || courseOfStudyResult.error) {
        throw new Error(`Textract extraction failed: Transcript: ${transcriptResult.error || 'OK'}, Course of Study: ${courseOfStudyResult.error || 'OK'}`);
      }

      if (!transcriptResult.text.trim() || !courseOfStudyResult.text.trim()) {
        throw new Error("Failed to extract text from one or both PDFs using Amazon Textract");
      }

      const processingTime = Date.now() - startTime;

      console.log(`[Testing Processing] Amazon Textract extraction complete:`, {
        transcriptTextLength: transcriptResult.text.length,
        transcriptConfidence: transcriptResult.confidence,
        courseOfStudyTextLength: courseOfStudyResult.text.length,
        courseOfStudyConfidence: courseOfStudyResult.confidence,
        processingTime: `${processingTime}ms`,
      });

      // AI-first course extraction to maximize recall
      console.log(`[Testing Processing] AI-first extraction of transcript courses`);
      const aiExtracted = await ctx.runAction(internal.enhancedCourseExtraction.extractWithAI, {
        text: transcriptResult.text,
        gradeThreshold: testingTranscript.gradeThreshold,
        institution: "plaksha",
      });

      // Normalize and filter AI results by threshold (strip extra fields to satisfy validator)
      const aiForFilter = aiExtracted.map((c: any) => ({
        title: c.title,
        description: c.description,
        grade: c.grade,
        credits: c.credits,
        semester: c.semester,
        code: c.code,
      }));
      const aiFiltered = await ctx.runMutation(internal.gradeNormalization.filterCoursesByGradeWithNormalization, {
        courses: aiForFilter,
        gradeThreshold: testingTranscript.gradeThreshold,
        institution: "plaksha",
      });

      let combinedExtractedCourses = aiFiltered;

      // If AI produced too few courses, supplement with regex-based extraction
      if (combinedExtractedCourses.length < 6) {
        console.log(`[Testing Processing] Low AI course count (${combinedExtractedCourses.length}). Supplementing with regex extraction.`);
        const regexExtracted = await ctx.runMutation(internal.enhancedCourseExtraction.extractCoursesWithMultiPass, {
          transcriptText: transcriptResult.text,
          gradeThreshold: testingTranscript.gradeThreshold,
          institution: "plaksha",
        });

        const seenCodes = new Set<string>();
        const seenTitles = new Set<string>();
        const merged: typeof regexExtracted = [];
        const addCourse = (c: any) => {
          const normTitle = (c.title || "").toLowerCase().replace(/\s+/g, " ").trim();
          const normCode = (c.code || "").toLowerCase().replace(/\s+/g, "").trim();
          if (normCode) {
            if (seenCodes.has(normCode)) return;
            seenCodes.add(normCode);
          } else {
            if (seenTitles.has(normTitle)) return;
            seenTitles.add(normTitle);
          }
          merged.push(c);
        };
        for (const c of combinedExtractedCourses) addCourse({ ...c, extractionMethod: (c as any).extractionMethod ?? ("ai" as const) });
        for (const c of regexExtracted) addCourse({ ...c, extractionMethod: (c as any).extractionMethod ?? ("regex" as const) });
        combinedExtractedCourses = merged;
        console.log(`[Testing Processing] After AI+regex merge, total extracted courses: ${combinedExtractedCourses.length}`);
      }

      // Keep original extraction method for course matching (which expects "regex")
      const extractedCoursesForMatching = combinedExtractedCourses.map(course => ({
        title: course.title,
        description: course.description,
        grade: course.grade,
        credits: course.credits,
        semester: course.semester,
        code: course.code,
        confidence: (course as any).confidence,
        extractionMethod: (course as any).extractionMethod as "regex" | "ai" | "fuzzy" | "manual", // Keep original for course matching
      }));

      // Extract curriculum courses from course of study
      const curriculumCourses = await ctx.runMutation(internal.courseExtraction.extractCurriculumCourses, {
        courseOfStudyText: courseOfStudyResult.text,
      });

      // Match transcript courses to course of study courses and enhance descriptions
      console.log(`[Testing Processing] Starting course matching for ${extractedCoursesForMatching.length} transcript courses against ${curriculumCourses.length} course of study courses`);
      
      const matchingResults = await ctx.runMutation(internal.courseMatching.matchTranscriptToCourseOfStudy, {
        transcriptCourses: extractedCoursesForMatching,
        courseOfStudyCourses: curriculumCourses,
        matchingThreshold: 0.25, // Lower threshold to handle OCR errors
      });

      // Transform matched courses to match our testing transcripts schema
      const enhancedCourses = matchingResults.matchedCourses.map(course => ({
        ...course,
        // Convert extraction method from course matching format to testing transcripts format
        extractionMethod: (course.extractionMethod === "regex" ? "textract" : course.extractionMethod) as "textract" | "ai" | "fuzzy" | "manual",
      }));
      
      console.log(`[Testing Processing] Course matching complete:`, {
        originalCourses: extractedCoursesForMatching.length,
        matchedCourses: enhancedCourses.length,
        unmatchedCourses: matchingResults.unmatchedCourses.length,
        matchingRate: matchingResults.matchingStats.matchingRate,
      });

      // Prepare Textract results for storage
      const textractResults = {
        transcriptConfidence: transcriptResult.confidence,
        courseOfStudyConfidence: courseOfStudyResult.confidence,
        processingTime,
        featuresUsed: testingTranscript.useAdvancedFeatures ? ["TABLES", "FORMS"] : ["TEXT_DETECTION"],
      };

      // Update the testing transcript with enhanced courses and Textract results
      await ctx.runMutation(internal.testingTranscripts.updateTestingTranscriptData, {
        testingTranscriptId: args.testingTranscriptId,
        transcriptText: transcriptResult.text,
        courseOfStudyText: courseOfStudyResult.text,
        extractedCourses: enhancedCourses,
        curriculumCourses,
        textractResults,
        status: "completed",
      });

      console.log(`[Testing Processing] Successfully processed testing transcript ${args.testingTranscriptId}:`, {
        originalExtractedCourses: extractedCoursesForMatching.length,
        enhancedCourses: enhancedCourses.length,
        curriculumCourses: curriculumCourses.length,
        gradeThreshold: testingTranscript.gradeThreshold,
        matchingRate: matchingResults.matchingStats.matchingRate,
        textractConfidence: {
          transcript: transcriptResult.confidence.toFixed(2) + "%",
          courseOfStudy: courseOfStudyResult.confidence.toFixed(2) + "%",
        },
        processingTime: `${processingTime}ms`,
      });

    } catch (error) {
      console.error("[Testing Processing] Error processing testing PDFs:", error);
      await ctx.runMutation(internal.testingTranscripts.updateTestingTranscriptStatus, {
        testingTranscriptId: args.testingTranscriptId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});
