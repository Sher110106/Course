import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Enhanced course matching that replaces transcript descriptions with course of study descriptions
export const matchTranscriptToCourseOfStudy = internalMutation({
  args: {
    transcriptCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
      code: v.optional(v.string()),
      confidence: v.optional(v.number()),
      extractionMethod: v.optional(v.union(v.literal("regex"), v.literal("ai"), v.literal("fuzzy"), v.literal("manual"))),
    })),
    courseOfStudyCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
      isRequired: v.boolean(),
      semester: v.optional(v.number()),
    })),
    matchingThreshold: v.optional(v.number()), // Default: 0.3
  },
  handler: async (ctx, args): Promise<{
    matchedCourses: Array<{
      title: string,
      description: string, // This will be from course of study
      grade: string,
      credits?: number,
      semester?: string,
      code?: string,
      confidence?: number,
      extractionMethod?: "regex" | "ai" | "fuzzy" | "manual",
      courseOfStudyMatch: {
        originalTranscriptDescription: string,
        courseOfStudyDescription: string,
        courseOfStudyTitle: string,
        courseOfStudyCode: string,
        matchScore: number,
        matchType: "exact_code" | "exact_title" | "fuzzy_title" | "partial_match",
      },
    }>,
    unmatchedCourses: Array<{
      title: string,
      description: string,
      grade: string,
      code?: string,
      reason: string,
      bestMatch?: {
        courseOfStudyTitle: string,
        similarity: number,
      },
    }>,
    matchingStats: {
      totalTranscriptCourses: number,
      matchedCourses: number,
      unmatchedCourses: number,
      matchingRate: number,
    },
  }> => {
    const threshold = args.matchingThreshold || 0.3;
    const matchedCourses: any[] = [];
    const unmatchedCourses: any[] = [];

    console.log(`[Course Matching] Starting matching for ${args.transcriptCourses.length} transcript courses against ${args.courseOfStudyCourses.length} course of study courses`);
    console.log(`[Course Matching] Using matching threshold: ${threshold}`);

    for (const transcriptCourse of args.transcriptCourses) {
      console.log(`[Course Matching] Processing: "${transcriptCourse.title}"`);
      
      // Validate grade first
      const gradeValidation = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
        grade: transcriptCourse.grade,
        institution: "plaksha",
      });

      if (!gradeValidation.isValid) {
        unmatchedCourses.push({
          title: transcriptCourse.title,
          description: transcriptCourse.description,
          grade: transcriptCourse.grade,
          code: transcriptCourse.code,
          reason: `Invalid grade "${transcriptCourse.grade}" - this grade type is not accepted`,
        });
        console.log(`[Course Matching] REJECTED: "${transcriptCourse.title}" - Invalid grade "${transcriptCourse.grade}"`);
        continue;
      }

      let bestMatch: {
        courseOfStudyCourse: any,
        score: number,
        matchType: "exact_code" | "exact_title" | "fuzzy_title" | "partial_match",
      } | null = null;

      // Step 1: Try exact code matching
      if (transcriptCourse.code) {
        const exactCodeMatch = args.courseOfStudyCourses.find(course => 
          course.code && 
          normalizeText(course.code) === normalizeText(transcriptCourse.code!)
        );
        
        if (exactCodeMatch) {
          bestMatch = {
            courseOfStudyCourse: exactCodeMatch,
            score: 1.0,
            matchType: "exact_code",
          };
          console.log(`[Course Matching] Found exact code match: ${transcriptCourse.code} -> ${exactCodeMatch.title}`);
        }
      }

      // Step 2: Try exact title matching (allowing for OCR errors)
      if (!bestMatch) {
        const exactTitleMatch = args.courseOfStudyCourses.find(course => 
          normalizeText(course.title) === normalizeText(transcriptCourse.title)
        );
        
        if (exactTitleMatch) {
          bestMatch = {
            courseOfStudyCourse: exactTitleMatch,
            score: 0.95,
            matchType: "exact_title",
          };
          console.log(`[Course Matching] Found exact title match: "${transcriptCourse.title}" -> "${exactTitleMatch.title}"`);
        }
      }

      // Step 3: Try fuzzy title matching (handles OCR errors)
      if (!bestMatch) {
        let highestScore = 0;
        let fuzzyMatch: any = null;

        for (const courseOfStudyCourse of args.courseOfStudyCourses) {
          const similarity = calculateTextSimilarity(transcriptCourse.title, courseOfStudyCourse.title);
          
          if (similarity > highestScore) {
            highestScore = similarity;
            fuzzyMatch = courseOfStudyCourse;
          }
        }

        if (fuzzyMatch && highestScore >= threshold) {
          bestMatch = {
            courseOfStudyCourse: fuzzyMatch,
            score: highestScore,
            matchType: "fuzzy_title",
          };
          console.log(`[Course Matching] Found fuzzy title match: "${transcriptCourse.title}" -> "${fuzzyMatch.title}" (score: ${highestScore.toFixed(3)})`);
        }
      }

      // Step 4: Try partial matching with key terms (handles significant OCR errors)
      if (!bestMatch) {
        let highestScore = 0;
        let partialMatch: any = null;

        const transcriptKeywords = extractKeywords(transcriptCourse.title);
        
        for (const courseOfStudyCourse of args.courseOfStudyCourses) {
          const courseOfStudyKeywords = extractKeywords(courseOfStudyCourse.title);
          const keywordSimilarity = calculateKeywordSimilarity(transcriptKeywords, courseOfStudyKeywords);
          
          if (keywordSimilarity > highestScore && keywordSimilarity >= threshold * 0.7) { // Lower threshold for partial matching
            highestScore = keywordSimilarity;
            partialMatch = courseOfStudyCourse;
          }
        }

        if (partialMatch && highestScore >= threshold * 0.7) {
          bestMatch = {
            courseOfStudyCourse: partialMatch,
            score: highestScore,
            matchType: "partial_match",
          };
          console.log(`[Course Matching] Found partial match: "${transcriptCourse.title}" -> "${partialMatch.title}" (score: ${highestScore.toFixed(3)})`);
        }
      }

      // Step 5: Decide matching outcome
      if (bestMatch && bestMatch.score >= threshold) {
        // Course is matched - REPLACE DESCRIPTION with course of study description
        const enhancedCourse = {
          title: transcriptCourse.title, // Keep original title from transcript
          description: bestMatch.courseOfStudyCourse.description, // ⭐ USE COURSE OF STUDY DESCRIPTION
          grade: transcriptCourse.grade,
          credits: transcriptCourse.credits || bestMatch.courseOfStudyCourse.credits,
          semester: transcriptCourse.semester,
          code: transcriptCourse.code || bestMatch.courseOfStudyCourse.code,
          confidence: transcriptCourse.confidence,
          extractionMethod: transcriptCourse.extractionMethod,
          courseOfStudyMatch: {
            originalTranscriptDescription: transcriptCourse.description,
            courseOfStudyDescription: bestMatch.courseOfStudyCourse.description,
            courseOfStudyTitle: bestMatch.courseOfStudyCourse.title,
            courseOfStudyCode: bestMatch.courseOfStudyCourse.code,
            matchScore: bestMatch.score,
            matchType: bestMatch.matchType,
          },
        };

        matchedCourses.push(enhancedCourse);
        console.log(`[Course Matching] MATCHED: "${transcriptCourse.title}" -> "${bestMatch.courseOfStudyCourse.title}" (score: ${bestMatch.score.toFixed(3)}, type: ${bestMatch.matchType})`);
        console.log(`[Course Matching] Description replaced: "${transcriptCourse.description.slice(0, 50)}..." -> "${bestMatch.courseOfStudyCourse.description.slice(0, 50)}..."`);
      } else {
        // Course is unmatched
        let reason = "No matching course found in course of study";
        
        if (bestMatch) {
          reason = `Low similarity score (${bestMatch.score.toFixed(3)} < ${threshold})`;
        } else if (isLikelyNonCourse(transcriptCourse.title)) {
          reason = "Appears to be non-course content (header, metadata, etc.)";
        } else if (transcriptCourse.title.length < 5) {
          reason = "Course title too short to be valid";
        } else if (containsInvalidPatterns(transcriptCourse.title)) {
          reason = "Contains invalid patterns or formatting";
        }

        unmatchedCourses.push({
          title: transcriptCourse.title,
          description: transcriptCourse.description,
          grade: transcriptCourse.grade,
          code: transcriptCourse.code,
          reason,
          bestMatch: bestMatch ? {
            courseOfStudyTitle: bestMatch.courseOfStudyCourse.title,
            similarity: bestMatch.score,
          } : undefined,
        });
        console.log(`[Course Matching] UNMATCHED: "${transcriptCourse.title}" - ${reason}`);
      }
    }

    const matchingStats = {
      totalTranscriptCourses: args.transcriptCourses.length,
      matchedCourses: matchedCourses.length,
      unmatchedCourses: unmatchedCourses.length,
      matchingRate: matchedCourses.length / args.transcriptCourses.length,
    };

    console.log(`[Course Matching] Matching complete:`, matchingStats);

    return {
      matchedCourses,
      unmatchedCourses,
      matchingStats,
    };
  },
});

// Utility functions for text processing and matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .trim();
}

function calculateTextSimilarity(text1: string, text2: string): number {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  
  // Exact match
  if (normalized1 === normalized2) {
    return 1.0;
  }
  
  // Jaccard similarity with word tokens
  const words1 = new Set(normalized1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(normalized2.split(' ').filter(w => w.length > 2));
  
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  const union = new Set([...words1, ...words2]);
  
  if (union.size === 0) return 0;
  
  const jaccardSimilarity = intersection.size / union.size;
  
  // Boost score for substring matches (helps with OCR errors)
  const substringBoost = (normalized1.includes(normalized2) || normalized2.includes(normalized1)) ? 0.2 : 0;
  
  // Additional boost for similar length (helps with OCR errors)
  const lengthSimilarity = 1 - Math.abs(normalized1.length - normalized2.length) / Math.max(normalized1.length, normalized2.length);
  const lengthBoost = lengthSimilarity > 0.8 ? 0.1 : 0;
  
  return Math.min(1.0, jaccardSimilarity + substringBoost + lengthBoost);
}

function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(word => word.length > 2);
  
  // Filter out common academic words that don't add specificity
  const stopWords = ['introduction', 'advanced', 'fundamentals', 'principles', 'theory', 'practice', 'course', 'study', 'analysis', 'design', 'systems', 'methods', 'applications', 'basic', 'intermediate'];
  
  return words.filter(word => !stopWords.includes(word));
}

function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 && keywords2.length === 0) return 1.0;
  if (keywords1.length === 0 || keywords2.length === 0) return 0.0;
  
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  
  const intersection = new Set([...set1].filter(keyword => set2.has(keyword)));
  const union = new Set([...set1, ...set2]);
  
  return intersection.size / union.size;
}

function isLikelyNonCourse(title: string): boolean {
  const lowerTitle = title.toLowerCase();
  
  // Common non-course patterns
  const nonCoursePatterns = [
    /^(page|p\.?)\s*\d+/i, // Page numbers
    /^(semester|sem)\s*\d+/i, // Semester headers
    /^(year|yr)\s*\d+/i, // Year headers
    /^(total|sum|grand)/i, // Totals
    /^(credits?|units?|hours?)\s*:/i, // Credit headers
    /^(gpa|grade point)/i, // GPA info
    /^(transcript|record|report)/i, // Document headers
    /^(student|name|id)/i, // Student info
    /^(university|college|school)/i, // Institution headers
    /^(date|issued|printed)/i, // Date info
    /^\d+\.\d+$/, // Just numbers (like GPA)
    /^[a-z]\s*$/, // Single letters
    /^(and|or|the|of|in|on|at|to|for|with|by)$/i, // Prepositions alone
  ];
  
  return nonCoursePatterns.some(pattern => pattern.test(lowerTitle));
}

function containsInvalidPatterns(title: string): boolean {
  // Patterns that indicate this is likely not a course
  const invalidPatterns = [
    /^\d+$/, // Just numbers
    /^[A-Z]\s*$/, // Single letters
    /^\.+$/, // Just dots
    /^-+$/, // Just dashes
    /^\s*$/, // Just whitespace
    /^(tech|comp|sci|math|eng)\s+(in|and|or|of)\s+/i, // Incomplete course prefixes like "Tech in Computer"
  ];
  
  return invalidPatterns.some(pattern => pattern.test(title));
}
