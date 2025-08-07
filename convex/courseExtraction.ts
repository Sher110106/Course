import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Course extraction from transcript text
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
  }>> => {
    const lines = args.transcriptText.split('\n');
    const courses: Array<{
      title: string,
      description: string,
      grade: string,
      credits?: number,
      semester?: string,
    }> = [];

    // Common course patterns
    const coursePatterns = [
      // Pattern: Course Code - Course Title (Credits) Grade
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
      // Pattern: Course Title (Credits) Grade
      /([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*([A-Z][+-]?)/i,
      // Pattern: Course Code Course Title Grade
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
      // Pattern: Course Title Grade
      /([A-Z][a-z\s]+)\s+([A-Z][+-]?)/i,
    ];

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
          let semester: string | undefined = undefined;

          if (match.length === 5) {
            // Pattern 1: Course Code - Course Title (Credits) Grade
            title = `${match[1]} - ${match[2].trim()}`;
            credits = parseFloat(match[3]);
            grade = match[4];
          } else if (match.length === 4) {
            // Pattern 2: Course Title (Credits) Grade
            title = match[1].trim();
            credits = parseFloat(match[2]);
            grade = match[3];
          } else if (match.length === 4) {
            // Pattern 3: Course Code Course Title Grade
            title = `${match[1]} ${match[2].trim()}`;
            grade = match[3];
          } else if (match.length === 3) {
            // Pattern 4: Course Title Grade
            title = match[1].trim();
            grade = match[2];
          }

          // Validate grade
          const isValidGrade = await ctx.runMutation(internal.gradeFilter.validateGrade, {
            grade: grade,
          });

          if (isValidGrade && title.length > 3) {
            courses.push({
              title,
              description: `Extracted from transcript: ${title}`,
              grade,
              credits,
              semester,
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
              courses.push({
                title,
                description: `Extracted from transcript: ${title}`,
                grade,
                credits: undefined,
                semester: undefined,
              });
            }
          }
        }
      }
    }

    // Filter courses by grade threshold
    const filteredCourses = await ctx.runMutation(internal.gradeFilter.filterCoursesByGrade, {
      courses,
      gradeThreshold: args.gradeThreshold,
    });

    return filteredCourses;
  },
});

// Extract curriculum courses from course of study text
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
    const lines = args.courseOfStudyText.split('\n');
    const courses: Array<{
      code: string,
      title: string,
      description: string,
      credits?: number,
      isRequired: boolean,
      semester?: number,
    }> = [];

    // Curriculum course patterns
    const curriculumPatterns = [
      // Pattern: Course Code - Course Title (Credits) [Required/Core]
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*(?:\[(Required|Core|Elective)\])?/i,
      // Pattern: Course Code Course Title (Credits)
      /([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s+([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)/i,
      // Pattern: Course Title (Credits) [Required/Core]
      /([^(]+?)\s*\((\d+(?:\.\d+)?)\s*credits?\)\s*(?:\[(Required|Core|Elective)\])?/i,
      // Pattern: Semester X: Course Code - Course Title
      /Semester\s*(\d+)[:.]\s*([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[-–]\s*([^(]+?)/i,
    ];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      let courseFound = false;
      for (const pattern of curriculumPatterns) {
        const match = trimmedLine.match(pattern);
        if (match) {
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
          } else if (match.length === 4) {
            // Pattern 3: Course Title (Credits) [Required/Core]
            title = match[1].trim();
            credits = parseFloat(match[2]);
            isRequired = match[3] ? ['Required', 'Core'].includes(match[3]) : true;
          } else if (match.length === 4) {
            // Pattern 4: Semester X: Course Code - Course Title
            semester = parseInt(match[1]);
            code = match[2];
            title = match[3].trim();
          }

          if (title.length > 3) {
            courses.push({
              code: code || `CURR-${courses.length + 1}`,
              title,
              description: `Curriculum requirement: ${title}`,
              credits,
              isRequired,
              semester,
            });
            courseFound = true;
            break;
          }
        }
      }

      // If no pattern matched, try to extract course information
      if (!courseFound && trimmedLine.length > 10) {
        // Look for course code patterns
        const codeMatch = trimmedLine.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
        if (codeMatch) {
          const code = codeMatch[1];
          const title = trimmedLine.substring(trimmedLine.indexOf(code) + code.length).trim();
          
          if (title.length > 3) {
            courses.push({
              code,
              title,
              description: `Curriculum requirement: ${title}`,
              credits: undefined,
              isRequired: true,
              semester: undefined,
            });
          }
        }
      }
    }

    return courses;
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

// Helper function to get grade value
function getGradeValue(grade: string): number {
  const GRADE_VALUES = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D+': 1.3, 'D': 1.0, 'D-': 0.7,
    'F': 0.0
  } as const;
  
  return GRADE_VALUES[grade as keyof typeof GRADE_VALUES] || 0;
} 