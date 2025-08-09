import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Enhanced course extraction from transcript text with better description handling
export const extractCoursesFromTranscript = internalMutation({
  args: {
    transcriptText: v.string(),
    gradeThreshold: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    title: string,
    description: string,
    grade: string,
    credits?: number,
    semester?: string,
    code?: string,
  }>> => {
    const lines = args.transcriptText.split('\n');
    const courses: Array<{
      title: string,
      description: string,
      grade: string,
      credits?: number,
      semester?: string,
      code?: string,
    }> = [];

    // Enhanced course patterns with better description extraction
    const coursePatterns = [
      // Pattern: Course Code - Course Title (Credits) Grade
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
      // Pattern: Course Title (Credits) Grade
      /([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
      // Pattern: Course Code Course Title Grade
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
      // Pattern: Course Title Grade
      /([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
      // NEW: Pattern for course code followed by description
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([A-Za-z\s]+?)\s+([A-Z][+-]?)/i,
    ];

    // Track course descriptions from surrounding context
    const courseDescriptions = new Map<string, string>();

    // First pass: Extract course descriptions from context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Look for description patterns
      const descriptionPatterns = [
        /description[:\s]+(.+)/i,
        /overview[:\s]+(.+)/i,
        /introduction[:\s]+(.+)/i,
        /covers[:\s]+(.+)/i,
        /studies[:\s]+(.+)/i,
      ];

      for (const pattern of descriptionPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Look for course code in nearby lines
          for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
            const nearbyLine = lines[j].trim();
            const codeMatch = nearbyLine.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
            if (codeMatch) {
              courseDescriptions.set(codeMatch[1], match[1].trim());
              break;
            }
          }
        }
      }
    }

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      let courseFound = false;
      for (const pattern of coursePatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          let title = '';
          let grade = '';
          let credits: number | undefined = undefined;
          const semester: string | undefined = undefined;
          let code: string | undefined = undefined;

          if (match.length === 5) {
            // Pattern 1: Course Code - Course Title (Credits) Grade
            code = match[1];
            title = `${match[1]} - ${match[2].trim()}`;
            credits = parseFloat(match[3]);
            grade = match[4];
          } else if (match.length === 4) {
            // Pattern 2: Course Title (Credits) Grade
            title = match[1].trim();
            credits = parseFloat(match[2]);
            grade = match[3];
          } else if (match.length === 3) {
            // Pattern 3: Course Code Course Title Grade
            code = match[1];
            title = `${match[1]} ${match[2].trim()}`;
            grade = match[3];
          } else if (match.length === 2) {
            // Pattern 4: Course Title Grade
            title = match[1].trim();
            grade = match[2];
          }

          // Validate grade
          const isValidGrade = await ctx.runMutation(internal.gradeFilter.validateGrade, {
            grade: grade,
          });

          if (isValidGrade && title.length > 3) {
            // Try to get description from context or use a basic one
            let description = courseDescriptions.get(code || '') || '';
            if (!description) {
              // Generate a basic description based on title and code
              description = generateBasicCourseDescription(title, code);
            }

            courses.push({
              title,
              description: description || `Extracted from transcript: ${title}`,
              grade,
              credits,
              semester,
              code,
            });
            courseFound = true;
            break;
          }
        }
      }

      // If no pattern matched, try to extract using AI-powered approach
      if (!courseFound && trimmedLine.length > 10) {
        // Look for grade indicators in the line
        const gradeMatch = trimmedLine.match(/\b([A-Z][+-]?)\b/);
        if (gradeMatch) {
          const grade = gradeMatch[1];
          const isValidGrade = await ctx.runMutation(internal.gradeFilter.validateGrade, {
            grade: grade,
          });

          if (isValidGrade) {
            // Extract potential course title (everything before the grade)
            const title = trimmedLine.substring(0, trimmedLine.indexOf(grade)).trim();
            if (title.length > 3) {
              // Try to extract course code
              const codeMatch = title.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
              const code = codeMatch ? codeMatch[1] : undefined;
              
              // Generate basic description
              const description = generateBasicCourseDescription(title, code);
              
              courses.push({
                title,
                description: description || `Extracted from transcript: ${title}`,
                grade,
                credits: undefined,
                semester: undefined,
                code,
              });
            }
          }
        }
      }
    }

    // Filter courses by grade threshold with enhanced normalization
    const filteredCourses = await ctx.runMutation(internal.gradeNormalization.filterCoursesByGradeWithNormalization, {
      courses,
      gradeThreshold: args.gradeThreshold,
      institution: "plaksha", // Use Plaksha-specific configuration
    });

    return filteredCourses;
  },
});

// Enhanced curriculum course extraction with better description handling
export const extractCurriculumCourses = internalMutation({
  args: {
    courseOfStudyText: v.string(),
  },
  handler: async (ctx, args): Promise<Array<{
    code: string,
    title: string,
    description: string,
    credits?: number,
    isRequired: boolean,
    semester?: number,
  }>> => {
    console.log("[Curriculum Extraction] Starting extraction with text length:", args.courseOfStudyText.length);
    console.log("[Curriculum Extraction] First 500 characters:", args.courseOfStudyText.slice(0, 500));
    
    const lines = args.courseOfStudyText.split('\n');
    console.log("[Curriculum Extraction] Total lines:", lines.length);
    
    const courses: Array<{
      code: string,
      title: string,
      description: string,
      credits?: number,
      isRequired: boolean,
      semester?: number,
    }> = [];

    // Enhanced curriculum course patterns
    const curriculumPatterns = [
      // Pattern: Course Code - Course Title (Credits) [Required/Core]
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*(?:\[(Required|Core|Elective)\])?/i,
      // Pattern: Course Code Course Title (Credits)
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)/i,
      // Pattern: Course Title (Credits) [Required/Core]
      /([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*(?:\[(Required|Core|Elective)\])?/i,
      // Pattern: Semester X: Course Code - Course Title
      /Semester\s*(\d+)[:.]\s*([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)/i,
      // NEW: More flexible patterns
      // Pattern: Course Code - Course Title
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([A-Za-z\s]+)/i,
      // Pattern: Course Code Course Title
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Za-z\s]+)/i,
      // Pattern: Number. Course Title
      /(\d+)\.\s*([A-Za-z\s]+)/i,
      // Pattern: Course Title (Credits)
      /([A-Za-z\s]+)\s*\((\d+(?:\.\d+)?)\s*credits?\)/i,
    ];

    // Track course descriptions from context
    const courseDescriptions = new Map<string, string>();

    // First pass: Extract course descriptions from context
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Look for description patterns
      const descriptionPatterns = [
        /description[:\s]+(.+)/i,
        /overview[:\s]+(.+)/i,
        /introduction[:\s]+(.+)/i,
        /covers[:\s]+(.+)/i,
        /studies[:\s]+(.+)/i,
        /focuses[:\s]+(.+)/i,
        /explores[:\s]+(.+)/i,
      ];

      for (const pattern of descriptionPatterns) {
        const match = line.match(pattern);
        if (match) {
          // Look for course code in nearby lines
          for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
            const nearbyLine = lines[j].trim();
            const codeMatch = nearbyLine.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
            if (codeMatch) {
              courseDescriptions.set(codeMatch[1], match[1].trim());
              break;
            }
          }
        }
      }
    }

    let processedLines = 0;
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      processedLines++;
      if (processedLines <= 10) {
        console.log(`[Curriculum Extraction] Processing line ${processedLines}:`, trimmedLine);
      }

      let courseFound = false;
      for (const pattern of curriculumPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
          console.log(`[Curriculum Extraction] Pattern matched for line ${processedLines}:`, match);
          let code = '';
          let title = '';
          let credits: number | undefined = undefined;
          let isRequired = true;
          let semester: number | undefined = undefined;

          if (match.length === 5) {
            // Pattern 1: Course Code - Course Title (Credits) [Required/Core]
            code = match[1];
            title = match[2].trim();
            credits = parseFloat(match[3]);
            isRequired = match[4] ? ['Required', 'Core'].includes(match[4]) : true;
          } else if (match.length === 4) {
            // Pattern 2: Course Code Course Title (Credits)
            code = match[1];
            title = match[2].trim();
            credits = parseFloat(match[3]);
          } else if (match.length === 5) {
            // Pattern 3: Course Title (Credits) [Required/Core]
            title = match[1].trim();
            credits = parseFloat(match[2]);
            isRequired = match[3] ? ['Required', 'Core'].includes(match[3]) : true;
          } else if (match.length === 4) {
            // Pattern 4: Semester X: Course Code - Course Title
            semester = parseInt(match[1]);
            code = match[2];
            title = match[3].trim();
          } else if (match.length === 3) {
            // NEW: Handle new flexible patterns
            if (match[1].match(/^[A-Z]{2,4}\s*\d{3,4}[A-Z]?$/)) {
              // Pattern: Course Code - Course Title
              code = match[1];
              title = match[2].trim();
            } else if (match[1].match(/^\d+$/)) {
              // Pattern: Number. Course Title
              title = match[2].trim();
            } else {
              // Pattern: Course Title (Credits)
              title = match[1].trim();
              credits = parseFloat(match[2]);
            }
          } else if (match.length === 2) {
            // Pattern: Course Code Course Title (without credits)
            if (match[1].match(/^[A-Z]{2,4}\s*\d{3,4}[A-Z]?$/)) {
              code = match[1];
              title = match[2].trim();
            } else {
              title = match[1].trim();
            }
          }

          if (title.length > 3) {
            // Try to get description from context or generate a basic one
            let description = courseDescriptions.get(code || '') || '';
            if (!description) {
              description = generateBasicCourseDescription(title, code);
            }

            courses.push({
              code: code || `CURR-${courses.length + 1}`,
              title,
              description: description || `Curriculum requirement: ${title}`,
              credits,
              isRequired,
              semester,
            });
            courseFound = true;
            console.log(`[Curriculum Extraction] Added course: ${title}`);
            break;
          }
        }
      }

      // If no pattern matched, try to extract course information
      if (!courseFound && trimmedLine.length > 10) {
        // Look for course code patterns
        const codeMatch = trimmedLine.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
        if (codeMatch) {
          console.log(`[Curriculum Extraction] Found course code in line ${processedLines}:`, codeMatch[1]);
          const code = codeMatch[1];
          const title = trimmedLine.substring(trimmedLine.indexOf(code) + code.length).trim();
          
          if (title.length > 3) {
            // Generate basic description
            const description = generateBasicCourseDescription(title, code);
            
            courses.push({
              code,
              title,
              description: description || `Curriculum requirement: ${title}`,
              credits: undefined,
              isRequired: true,
              semester: undefined,
            });
            console.log(`[Curriculum Extraction] Added course with code: ${title}`);
          }
        }
      }
    }

    console.log(`[Curriculum Extraction] Final result: ${courses.length} courses extracted`);
    
    return courses;
  },
});

// Basic course description generation (no AI, safe for mutations)
function generateBasicCourseDescription(title: string, code?: string): string {
  const titleLower = title.toLowerCase();
  
  // Extract key terms from title
  const terms = titleLower.split(/\s+/).filter(term => 
    term.length > 2 && !['and', 'the', 'for', 'with', 'in', 'of', 'to', 'a', 'an'].includes(term)
  );
  
  if (terms.length === 0) {
    return `Course covering ${titleLower}`;
  }
  
  // Generate description based on common course patterns
  if (titleLower.includes('computer') || titleLower.includes('programming') || titleLower.includes('software')) {
    return `Computer science course covering ${terms.join(' ')}. Focuses on programming, algorithms, and software development principles.`;
  } else if (titleLower.includes('mathematics') || titleLower.includes('math') || titleLower.includes('calculus')) {
    return `Mathematics course covering ${terms.join(' ')}. Develops mathematical reasoning and problem-solving skills.`;
  } else if (titleLower.includes('physics') || titleLower.includes('chemistry') || titleLower.includes('biology')) {
    return `Science course covering ${terms.join(' ')}. Explores fundamental principles and experimental methods.`;
  } else if (titleLower.includes('engineering') || titleLower.includes('design')) {
    return `Engineering course covering ${terms.join(' ')}. Focuses on design principles and practical applications.`;
  } else if (titleLower.includes('network') || titleLower.includes('communication')) {
    return `Communication and networking course covering ${terms.join(' ')}. Explores data transmission and network protocols.`;
  } else if (titleLower.includes('data') || titleLower.includes('database') || titleLower.includes('analysis')) {
    return `Data science course covering ${terms.join(' ')}. Focuses on data processing, analysis, and visualization.`;
  } else {
    return `Course covering ${terms.join(' ')}. Provides foundational knowledge and practical skills in the subject area.`;
  }
}

// AI-powered course description generation (separate action)
export const generateAICourseDescription = internalAction({
  args: {
    title: v.string(),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<string> => {
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

      const prompt = `Generate a brief, educational description for this course. Focus on what students learn and the key topics covered.

Course: ${args.code ? `${args.code} - ` : ''}${args.title}

Description:`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an educational expert. Generate concise, informative course descriptions that focus on learning outcomes and key topics. Keep descriptions under 100 words."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const description = response.choices[0]?.message?.content?.trim();
      return description || `Course covering ${args.title.toLowerCase()}`;
    } catch (error) {
      console.warn("[Course Description Generation] Failed to generate description:", error);
      return `Course covering ${args.title.toLowerCase()}`;
    }
  },
});

// Enhanced course matching by course code
export const matchCoursesByCode = internalMutation({
  args: {
    userCourses: v.array(v.object({
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
  },
  handler: async (ctx, args): Promise<Array<{
    userCourse: string,
    curriculumCourse: string,
    matchType: "exact_code" | "partial_code" | "similar_title",
    confidence: number,
  }>> => {
    const matches: Array<{
      userCourse: string,
      curriculumCourse: string,
      matchType: "exact_code" | "partial_code" | "similar_title",
      confidence: number,
    }> = [];

    for (const userCourse of args.userCourses) {
      let bestMatch: {
        curriculumCourse: string,
        matchType: "exact_code" | "partial_code" | "similar_title",
        confidence: number,
      } | null = null;

      for (const curriculumCourse of args.curriculumCourses) {
        // Exact code match
        if (userCourse.code && curriculumCourse.code && 
            userCourse.code.toLowerCase() === curriculumCourse.code.toLowerCase()) {
          bestMatch = {
            curriculumCourse: curriculumCourse.title,
            matchType: "exact_code" as const,
            confidence: 1.0,
          };
          break;
        }

        // Partial code match (e.g., "CS101" matches "CS101A")
        if (userCourse.code && curriculumCourse.code) {
          const userCode = userCourse.code.toLowerCase();
          const curriculumCode = curriculumCourse.code.toLowerCase();
          
          if (userCode.includes(curriculumCode) || curriculumCode.includes(userCode)) {
            const confidence = Math.min(userCode.length, curriculumCode.length) / 
                             Math.max(userCode.length, curriculumCode.length);
            
            if (confidence > 0.7 && (!bestMatch || confidence > (bestMatch as any).confidence)) {
              bestMatch = {
                curriculumCourse: curriculumCourse.title,
                matchType: "partial_code" as const,
                confidence,
              };
            }
          }
        }

        // Similar title match (fallback)
        if (!bestMatch) {
          const userTitle = userCourse.title.toLowerCase();
          const curriculumTitle = curriculumCourse.title.toLowerCase();
          
          // Simple word overlap
          const userWords = userTitle.split(/\W+/).filter(Boolean);
          const curriculumWords = curriculumTitle.split(/\W+/).filter(Boolean);
          const commonWords = userWords.filter((word: string) => curriculumWords.includes(word));
          
          if (commonWords.length > 0) {
            const confidence = commonWords.length / Math.max(userWords.length, curriculumWords.length);
            
            if (confidence > 0.3 && (!bestMatch || confidence > (bestMatch as any).confidence)) {
              bestMatch = {
                curriculumCourse: curriculumCourse.title,
                matchType: "similar_title" as const,
                confidence,
              };
            }
          }
        }
      }

      if (bestMatch) {
        matches.push({
          userCourse: userCourse.title,
          curriculumCourse: bestMatch.curriculumCourse,
          matchType: bestMatch.matchType,
          confidence: bestMatch.confidence,
        });
      }
    }

    return matches;
  },
});

// Enhanced course parsing with AI assistance
export const parseCoursesWithAI = internalMutation({
  args: {
    text: v.string(),
    textType: v.union(v.literal("transcript"), v.literal("curriculum")),
    gradeThreshold: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<any> => {
    // This would integrate with Azure OpenAI for enhanced parsing
    // For now, we'll use the pattern-based approach
    if (args.textType === "transcript") {
      return await ctx.runMutation(internal.courseExtraction.extractCoursesFromTranscript, {
        transcriptText: args.text,
        gradeThreshold: args.gradeThreshold || "C",
      });
    } else {
      return await ctx.runMutation(internal.courseExtraction.extractCurriculumCourses, {
        courseOfStudyText: args.text,
      });
    }
  },
});

// Log course of study text for debugging
export const logCourseOfStudyText = internalMutation({
  args: {
    courseOfStudyText: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    console.log("[Course of Study Text] Full text length:", args.courseOfStudyText.length);
    console.log("[Course of Study Text] First 1000 characters:");
    console.log(args.courseOfStudyText.slice(0, 1000));
    console.log("[Course of Study Text] Last 1000 characters:");
    console.log(args.courseOfStudyText.slice(-1000));
  },
});

// Helper function to get grade value for comparison
function getGradeValue(grade: string): number {
  const gradeMap: Record<string, number> = {
    'A+': 4.3, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0,
  };
  return gradeMap[grade.toUpperCase()] || 0;
} 