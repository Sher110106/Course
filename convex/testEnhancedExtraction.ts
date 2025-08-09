import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

interface ExtractedCourse {
  title: string;
  description: string;
  grade: string;
  credits?: number;
  semester?: string;
  code?: string;
  confidence: number;
  extractionMethod: "regex" | "ai" | "fuzzy" | "manual";
}

interface GradeTestResult {
  originalGrade: string;
  normalizedGrade: string;
  numericValue: number;
  isValid: boolean;
}

interface TestResults {
  extractedCount: number;
  expectedCount: number;
  successRate: number;
  gradeSuccessRate: number;
  courses: ExtractedCourse[];
  gradeResults: GradeTestResult[];
  passed: boolean;
}

// Test function to verify enhanced course extraction
export const testEnhancedExtraction = mutation({
  args: {
    testTranscriptText: v.string(),
    expectedCourseCount: v.number(),
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args): Promise<TestResults> => {
    console.log("[Test] Starting enhanced extraction test");
    console.log("[Test] Expected course count:", args.expectedCourseCount);
    console.log("[Test] Grade threshold:", args.gradeThreshold);
    
    // Test the enhanced extraction
    const extractedCourses: ExtractedCourse[] = await ctx.runMutation(internal.enhancedCourseExtraction.extractCoursesWithMultiPass, {
      transcriptText: args.testTranscriptText,
      gradeThreshold: args.gradeThreshold,
      institution: "plaksha",
    });
    
    console.log("[Test] Extracted courses:", extractedCourses.length);
    console.log("[Test] Course details:");
    extractedCourses.forEach((course: ExtractedCourse, index: number) => {
      console.log(`[Test] ${index + 1}. ${course.title} - Grade: ${course.grade} - Method: ${course.extractionMethod} - Confidence: ${course.confidence}`);
    });
    
    // Test grade normalization
    const gradeTestResults: GradeTestResult[] = [];
    for (const course of extractedCourses) {
      const gradeResult = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
        grade: course.grade,
        institution: "plaksha",
      });
      gradeTestResults.push({
        originalGrade: course.grade,
        normalizedGrade: gradeResult.normalizedGrade,
        numericValue: gradeResult.numericValue,
        isValid: gradeResult.isValid,
      });
    }
    
    console.log("[Test] Grade normalization results:");
    gradeTestResults.forEach((result: GradeTestResult, index: number) => {
      console.log(`[Test] ${index + 1}. ${result.originalGrade} -> ${result.normalizedGrade} (${result.numericValue}) - Valid: ${result.isValid}`);
    });
    
    // Calculate success metrics
    const successRate: number = extractedCourses.length / args.expectedCourseCount;
    const validGrades: number = gradeTestResults.filter((r: GradeTestResult) => r.isValid).length;
    const gradeSuccessRate: number = validGrades / extractedCourses.length;
    
    const testResults: TestResults = {
      extractedCount: extractedCourses.length,
      expectedCount: args.expectedCourseCount,
      successRate,
      gradeSuccessRate,
      courses: extractedCourses,
      gradeResults: gradeTestResults,
      passed: extractedCourses.length >= args.expectedCourseCount && gradeSuccessRate > 0.8,
    };
    
    console.log("[Test] Test results:", testResults);
    
    return testResults;
  },
});

// Test function for pattern matching
export const testPatternMatching = mutation({
  args: {
    testLines: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<Array<{
    line: string;
    matches: Array<{
      patternIndex: number;
      match: RegExpMatchArray;
      groups: string[];
    }>;
  }>> => {
    console.log("[Pattern Test] Testing pattern matching");
    
    const patternResults: Array<{
      line: string;
      matches: Array<{
        patternIndex: number;
        match: RegExpMatchArray;
        groups: string[];
      }>;
    }> = [];
    
    for (const line of args.testLines) {
      console.log(`[Pattern Test] Testing line: "${line}"`);
      
      // Test each pattern
      const patterns = [
        /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
        /([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
        /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
        /([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
        /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([A-Za-z\s]+?)\s+([A-Z][+-]?)/i,
        /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([A-Za-z\s]+)/i,
        /(\d+)\.\s*([A-Za-z\s]+)/i,
        /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Za-z\s]+)/i,
      ];
      
      const lineResults: Array<{
        patternIndex: number;
        match: RegExpMatchArray;
        groups: string[];
      }> = [];
      for (let i = 0; i < patterns.length; i++) {
        const pattern = patterns[i];
        const match = line.match(pattern);
        if (match) {
          lineResults.push({
            patternIndex: i,
            match: match,
            groups: match.slice(1),
          });
        }
      }
      
      patternResults.push({
        line,
        matches: lineResults,
      });
      
      console.log(`[Pattern Test] Found ${lineResults.length} matches for line`);
    }
    
    return patternResults;
  },
});

// Test function for grade validation
export const testGradeValidation = mutation({
  args: {
    testGrades: v.array(v.string()),
    threshold: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    originalGrade: string;
    normalizedGrade: string;
    numericValue: number;
    isValid: boolean;
    meetsThreshold: boolean;
    thresholdValue: number;
  }>> => {
    console.log("[Grade Test] Testing grade validation");
    console.log("[Grade Test] Threshold:", args.threshold);
    
    const gradeResults: Array<{
      originalGrade: string;
      normalizedGrade: string;
      numericValue: number;
      isValid: boolean;
      meetsThreshold: boolean;
      thresholdValue: number;
    }> = [];
    
    for (const grade of args.testGrades) {
      console.log(`[Grade Test] Testing grade: "${grade}"`);
      
      const gradeResult = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
        grade,
        institution: "plaksha",
      });
      
      const thresholdValidation = await ctx.runMutation(internal.gradeNormalization.validateGradeAgainstThreshold, {
        grade,
        threshold: args.threshold,
        institution: "plaksha",
      });
      
      gradeResults.push({
        originalGrade: grade,
        normalizedGrade: gradeResult.normalizedGrade,
        numericValue: gradeResult.numericValue,
        isValid: gradeResult.isValid,
        meetsThreshold: thresholdValidation.meetsThreshold,
        thresholdValue: thresholdValidation.thresholdValue,
      });
      
      console.log(`[Grade Test] ${grade} -> ${gradeResult.normalizedGrade} (${gradeResult.numericValue}) - Valid: ${gradeResult.isValid} - Meets threshold: ${thresholdValidation.meetsThreshold}`);
    }
    
    return gradeResults;
  },
});
