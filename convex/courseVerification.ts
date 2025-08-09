import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Course verification system to cross-reference transcript courses against curriculum
export const verifyCourseAgainstCurriculum = internalMutation({
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
    curriculumCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      credits: v.optional(v.number()),
      isRequired: v.boolean(),
      semester: v.optional(v.number()),
    })),
    verificationThreshold: v.optional(v.number()), // Minimum similarity score to consider valid (default: 0.3)
  },
  handler: async (ctx, args): Promise<{
    verifiedCourses: Array<{
      title: string,
      description: string,
      grade: string,
      credits?: number,
      semester?: string,
      code?: string,
      confidence?: number,
      extractionMethod?: "regex" | "ai" | "fuzzy" | "manual",
      verification: {
        isVerified: boolean,
        matchedCurriculumCourse?: string,
        verificationScore: number,
        matchType: "exact_code" | "exact_title" | "fuzzy_title" | "partial_match" | "no_match",
        reasonForRejection?: string,
      },
    }>,
    rejectedCourses: Array<{
      title: string,
      description: string,
      grade: string,
      code?: string,
      rejectionReason: string,
      bestMatch?: {
        curriculumCourse: string,
        similarity: number,
      },
    }>,
    verificationStats: {
      totalCourses: number,
      verifiedCourses: number,
      rejectedCourses: number,
      verificationRate: number,
    },
  }> => {
    const threshold = args.verificationThreshold || 0.3; // Default threshold
    const verifiedCourses: any[] = [];
    const rejectedCourses: any[] = [];

    console.log(`[Course Verification] Starting verification for ${args.transcriptCourses.length} transcript courses against ${args.curriculumCourses.length} curriculum courses`);
    console.log(`[Course Verification] Using verification threshold: ${threshold}`);

    for (const transcriptCourse of args.transcriptCourses) {
      console.log(`[Course Verification] Verifying: "${transcriptCourse.title}"`);
      
      let bestMatch: {
        curriculumCourse: any,
        score: number,
        matchType: "exact_code" | "exact_title" | "fuzzy_title" | "partial_match" | "no_match",
      } | null = null;

      // Step 1: Try exact code matching
      if (transcriptCourse.code) {
        const exactCodeMatch = args.curriculumCourses.find(curriculum => 
          curriculum.code && 
          normalizeText(curriculum.code) === normalizeText(transcriptCourse.code!)
        );
        
        if (exactCodeMatch) {
          bestMatch = {
            curriculumCourse: exactCodeMatch,
            score: 1.0,
            matchType: "exact_code",
          };
          console.log(`[Course Verification] Found exact code match: ${transcriptCourse.code} -> ${exactCodeMatch.title}`);
        }
      }

      // Step 2: Try exact title matching
      if (!bestMatch) {
        const exactTitleMatch = args.curriculumCourses.find(curriculum => 
          normalizeText(curriculum.title) === normalizeText(transcriptCourse.title)
        );
        
        if (exactTitleMatch) {
          bestMatch = {
            curriculumCourse: exactTitleMatch,
            score: 0.95,
            matchType: "exact_title",
          };
          console.log(`[Course Verification] Found exact title match: "${transcriptCourse.title}" -> "${exactTitleMatch.title}"`);
        }
      }

      // Step 3: Try fuzzy title matching
      if (!bestMatch) {
        let highestScore = 0;
        let fuzzyMatch: any = null;

        for (const curriculumCourse of args.curriculumCourses) {
          const similarity = calculateTextSimilarity(transcriptCourse.title, curriculumCourse.title);
          
          if (similarity > highestScore) {
            highestScore = similarity;
            fuzzyMatch = curriculumCourse;
          }
        }

        if (fuzzyMatch && highestScore >= threshold) {
          bestMatch = {
            curriculumCourse: fuzzyMatch,
            score: highestScore,
            matchType: "fuzzy_title",
          };
          console.log(`[Course Verification] Found fuzzy title match: "${transcriptCourse.title}" -> "${fuzzyMatch.title}" (score: ${highestScore.toFixed(3)})`);
        }
      }

      // Step 4: Try partial matching with key terms
      if (!bestMatch) {
        let highestScore = 0;
        let partialMatch: any = null;

        const transcriptKeywords = extractKeywords(transcriptCourse.title);
        
        for (const curriculumCourse of args.curriculumCourses) {
          const curriculumKeywords = extractKeywords(curriculumCourse.title);
          const keywordSimilarity = calculateKeywordSimilarity(transcriptKeywords, curriculumKeywords);
          
          if (keywordSimilarity > highestScore && keywordSimilarity >= threshold * 0.8) { // Lower threshold for partial matching
            highestScore = keywordSimilarity;
            partialMatch = curriculumCourse;
          }
        }

        if (partialMatch && highestScore >= threshold * 0.8) {
          bestMatch = {
            curriculumCourse: partialMatch,
            score: highestScore,
            matchType: "partial_match",
          };
          console.log(`[Course Verification] Found partial match: "${transcriptCourse.title}" -> "${partialMatch.title}" (score: ${highestScore.toFixed(3)})`);
        }
      }

      // Step 5: Check grade validity before final verification
      const gradeValidation = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
        grade: transcriptCourse.grade,
        institution: "plaksha",
      });

      if (!gradeValidation.isValid) {
        // Course is rejected due to invalid grade
        rejectedCourses.push({
          title: transcriptCourse.title,
          description: transcriptCourse.description,
          grade: transcriptCourse.grade,
          code: transcriptCourse.code,
          rejectionReason: `Invalid grade "${transcriptCourse.grade}" - this grade type is not accepted`,
          bestMatch: bestMatch ? {
            curriculumCourse: bestMatch.curriculumCourse.title,
            similarity: bestMatch.score,
          } : undefined,
        });
        console.log(`[Course Verification] REJECTED: "${transcriptCourse.title}" - Invalid grade "${transcriptCourse.grade}"`);
        continue;
      }

      // Step 6: Decide verification outcome
      if (bestMatch && bestMatch.score >= threshold) {
        // Course is verified
        verifiedCourses.push({
          ...transcriptCourse,
          verification: {
            isVerified: true,
            matchedCurriculumCourse: bestMatch.curriculumCourse.title,
            verificationScore: bestMatch.score,
            matchType: bestMatch.matchType,
          },
        });
        console.log(`[Course Verification] VERIFIED: "${transcriptCourse.title}" (score: ${bestMatch.score.toFixed(3)}, type: ${bestMatch.matchType})`);
      } else {
        // Course is rejected
        let rejectionReason = "No matching course found in curriculum";
        
        if (bestMatch) {
          rejectionReason = `Low similarity score (${bestMatch.score.toFixed(3)} < ${threshold})`;
        } else if (isLikelyNonCourse(transcriptCourse.title)) {
          rejectionReason = "Appears to be non-course content (header, metadata, etc.)";
        } else if (transcriptCourse.title.length < 5) {
          rejectionReason = "Course title too short to be valid";
        } else if (containsInvalidPatterns(transcriptCourse.title)) {
          rejectionReason = "Contains invalid patterns or formatting";
        }

        rejectedCourses.push({
          title: transcriptCourse.title,
          description: transcriptCourse.description,
          grade: transcriptCourse.grade,
          code: transcriptCourse.code,
          rejectionReason,
          bestMatch: bestMatch ? {
            curriculumCourse: bestMatch.curriculumCourse.title,
            similarity: bestMatch.score,
          } : undefined,
        });
        console.log(`[Course Verification] REJECTED: "${transcriptCourse.title}" - ${rejectionReason}`);
      }
    }

    const verificationStats = {
      totalCourses: args.transcriptCourses.length,
      verifiedCourses: verifiedCourses.length,
      rejectedCourses: rejectedCourses.length,
      verificationRate: verifiedCourses.length / args.transcriptCourses.length,
    };

    console.log(`[Course Verification] Verification complete:`, verificationStats);

    return {
      verifiedCourses,
      rejectedCourses,
      verificationStats,
    };
  },
});

// Advanced course verification with AI assistance for edge cases
export const verifyCoursesWithAI = internalAction({
  args: {
    transcriptCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      code: v.optional(v.string()),
    })),
    curriculumCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
    })),
    uncertainCourses: v.array(v.object({
      title: v.string(),
      bestMatch: v.optional(v.object({
        title: v.string(),
        similarity: v.number(),
      })),
    })),
  },
  handler: async (ctx, args): Promise<{
    aiVerifiedCourses: Array<{
      transcriptCourse: string,
      isValid: boolean,
      confidence: number,
      reasoning: string,
      suggestedMatch?: string,
    }>,
  }> => {
    try {
      const openai = new (await import("openai")).default({
        apiKey: process.env.AZURE_OPENAI_API_KEY || "dummy-key",
        baseURL: process.env.AZURE_OPENAI_ENDPOINT || "https://api.openai.com/v1",
        defaultQuery: {
          "api-version": process.env.OPENAI_API_VERSION || "2025-01-01-preview",
        },
        defaultHeaders: {
          "api-key": process.env.AZURE_OPENAI_API_KEY || "dummy-key",
        },
      });

      const aiVerifiedCourses: any[] = [];

      // Process courses in batches to avoid token limits
      const BATCH_SIZE = 5;
      for (let i = 0; i < args.uncertainCourses.length; i += BATCH_SIZE) {
        const batch = args.uncertainCourses.slice(i, i + BATCH_SIZE);
        
        const prompt = `You are an academic course verification expert. Your task is to determine if courses extracted from a transcript are valid academic courses that should appear in a curriculum.

CURRICULUM COURSES (valid courses that exist):
${args.curriculumCourses.slice(0, 20).map(c => `- ${c.code}: ${c.title}`).join('\n')}

UNCERTAIN COURSES TO VERIFY:
${batch.map((course, idx) => `${idx + 1}. "${course.title}"${course.bestMatch ? ` (best match: "${course.bestMatch.title}" with ${(course.bestMatch.similarity * 100).toFixed(1)}% similarity)` : ''}`).join('\n')}

For each uncertain course, determine:
1. Is this a valid academic course that could reasonably appear in a curriculum?
2. Is it likely a header, metadata, formatting artifact, or non-course content?
3. If there's a best match, is it reasonable to consider them the same course?

Respond in JSON format:
{
  "verifications": [
    {
      "courseNumber": 1,
      "isValid": true/false,
      "confidence": 0.0-1.0,
      "reasoning": "Brief explanation",
      "suggestedMatch": "curriculum course title if applicable"
    }
  ]
}

Focus on rejecting:
- Headers, metadata, page numbers
- Partial course titles or formatting artifacts
- Non-academic content
- Courses that are clearly not real academic subjects`;

        const response = await openai.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4.1',
          messages: [
            {
              role: "system",
              content: "You are an expert at identifying valid academic courses and filtering out non-course content from transcripts. Be conservative - when in doubt, reject the course."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });

        const aiResponse = JSON.parse(response.choices[0].message.content || '{"verifications": []}');
        
        for (const verification of aiResponse.verifications) {
          const courseIndex = verification.courseNumber - 1;
          if (courseIndex >= 0 && courseIndex < batch.length) {
            aiVerifiedCourses.push({
              transcriptCourse: batch[courseIndex].title,
              isValid: verification.isValid,
              confidence: verification.confidence,
              reasoning: verification.reasoning,
              suggestedMatch: verification.suggestedMatch,
            });
          }
        }

        // Small delay between batches
        if (i + BATCH_SIZE < args.uncertainCourses.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return { aiVerifiedCourses };
    } catch (error) {
      console.error("[AI Course Verification] Error:", error);
      // Fallback: reject all uncertain courses
      return {
        aiVerifiedCourses: args.uncertainCourses.map(course => ({
          transcriptCourse: course.title,
          isValid: false,
          confidence: 0.5,
          reasoning: "AI verification failed, defaulting to rejection for safety",
        })),
      };
    }
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
  
  // Boost score for substring matches
  const substringBoost = (normalized1.includes(normalized2) || normalized2.includes(normalized1)) ? 0.2 : 0;
  
  return Math.min(1.0, jaccardSimilarity + substringBoost);
}

function extractKeywords(text: string): string[] {
  const normalized = normalizeText(text);
  const words = normalized.split(' ').filter(word => word.length > 2);
  
  // Filter out common academic words that don't add specificity
  const stopWords = ['introduction', 'advanced', 'fundamentals', 'principles', 'theory', 'practice', 'course', 'study', 'analysis', 'design', 'systems', 'methods', 'applications'];
  
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

// Test function for course verification
export const testCourseVerification = internalMutation({
  args: {
    sampleTranscriptCourses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      code: v.optional(v.string()),
    })),
    sampleCurriculumCourses: v.array(v.object({
      code: v.string(),
      title: v.string(),
      description: v.string(),
      isRequired: v.boolean(),
    })),
  },
  handler: async (ctx, args): Promise<{
    verificationResults: any,
    testSummary: {
      totalTested: number,
      verified: number,
      rejected: number,
      verificationRate: number,
      exampleRejections: string[],
    },
  }> => {
    const verificationResults = await ctx.runMutation(internal.courseVerification.verifyCourseAgainstCurriculum, {
      transcriptCourses: args.sampleTranscriptCourses,
      curriculumCourses: args.sampleCurriculumCourses.map(c => ({
        code: c.code,
        title: c.title,
        description: c.description,
        isRequired: c.isRequired,
      })),
      verificationThreshold: 0.3,
    });

    const testSummary = {
      totalTested: verificationResults.verificationStats.totalCourses,
      verified: verificationResults.verificationStats.verifiedCourses,
      rejected: verificationResults.verificationStats.rejectedCourses,
      verificationRate: verificationResults.verificationStats.verificationRate,
      exampleRejections: verificationResults.rejectedCourses.slice(0, 5).map(r => `"${r.title}" - ${r.rejectionReason}`),
    };

    return {
      verificationResults,
      testSummary,
    };
  },
});
