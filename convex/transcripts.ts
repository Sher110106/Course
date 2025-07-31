"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
// import pdfParse from "pdf-parse";

// Internal action to process PDF
export const processPDF = internalAction({
  args: {
    transcriptId: v.id("userTranscripts"),
  },
  handler: async (ctx, args) => {
    try {
      // Update status to processing
      await ctx.runMutation(internal.transcriptData.updateTranscriptStatus, {
        transcriptId: args.transcriptId,
        status: "processing",
      });

      // Get transcript record
      const transcript = await ctx.runQuery(internal.transcriptData.getTranscriptById, {
        transcriptId: args.transcriptId,
      });

      if (!transcript) {
        throw new Error("Transcript not found");
      }

      // Use extractedText from transcript if available
      let extractedText = transcript.extractedText;
      if (!extractedText || !extractedText.trim()) {
        // Fallback: Get file from storage and extract text (should not happen in your flow)
        const file = await ctx.storage.get(transcript.fileId);
        if (!file) {
          throw new Error("File not found in storage");
        }
        extractedText = await extractTextFromPDF(file);
      }

      // Parse courses from extracted text
      const parsedCourses = await parseCourses(extractedText);

      // Update transcript with extracted data
      await ctx.runMutation(internal.transcriptData.updateTranscriptData, {
        transcriptId: args.transcriptId,
        extractedText,
        parsedCourses,
        status: "completed",
      });

      // Note: We don't trigger analysis here anymore since it requires authentication
      // The user will need to manually trigger analysis from the UI

    } catch (error) {
      console.error("PDF processing failed:", error);
      await ctx.runMutation(internal.transcriptData.updateTranscriptStatus, {
        transcriptId: args.transcriptId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
});

// Extract text from PDF using pdf-parse
async function extractTextFromPDF(file: Blob): Promise<string> {
  // TODO: Move PDF parsing to the client. This is a stub to allow deployment.
  return "";
}

// Parse courses from extracted text using string/array methods (no regex)
async function parseCourses(text: string): Promise<Array<{
  title: string;
  description: string;
  credits?: number;
}>> {
  console.log("[PDF Parser] Raw extracted text sample:", text.slice(0, 2000));
  const lines = text.split('\n');
  const courses = [];
  let currentCourse = null;
  let inSummary = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    // Stop parsing if we hit summary/statistics
    if (line.toLowerCase().includes("summary statistics")) {
      inSummary = true;
      break;
    }
    // Detect course start: e.g., "1. Engineering Mathematics - |"
    if (
      line.length > 2 &&
      line[1] === '.' &&
      !isNaN(Number(line[0]))
    ) {
      // Save previous course if exists
      if (currentCourse) courses.push(currentCourse);
      // Extract title (up to first dash or end of line)
      const namePart = line.slice(2).split('-')[0].trim();
      currentCourse = { title: namePart, description: '', credits: undefined as number | undefined };
    } else if (currentCourse) {
      if (line.startsWith('Course Code:')) {
        // Not used in output, but could be added if needed
      } else if (line.startsWith('Credits:')) {
        const creditsStr = line.replace('Credits:', '').trim();
        const creditsNum = Number(creditsStr);
        if (!isNaN(creditsNum)) currentCourse.credits = creditsNum;
      } else if (line.startsWith('Description:')) {
        currentCourse.description = line.replace('Description:', '').trim();
        // Check for multi-line description
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j].trim();
          // Stop if next course, semester, or summary/statistics
          if (
            (nextLine.length > 2 && nextLine[1] === '.' && !isNaN(Number(nextLine[0]))) ||
            nextLine.toLowerCase().includes('semester') ||
            nextLine.toLowerCase().includes('summary statistics')
          ) {
            break;
          }
          if (nextLine) currentCourse.description += ' ' + nextLine;
          j++;
        }
        i = j - 1; // Skip lines already processed
      }
    }
  }
  // Push the last course
  if (currentCourse) courses.push(currentCourse);
  console.log(`[PDF Parser] Parsed ${courses.length} courses.`);
  if (courses.length === 0) {
    console.warn("[PDF Parser] No courses parsed. Returning empty array.");
  }
  return courses;
}
