import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Load pattern registry
const PATTERN_REGISTRY = {
  "courseCodes": [
    {"pattern": "[A-Z]{2,4}\\s*\\d{3,4}[A-Z]?", "name": "standard_course_code"},
    {"pattern": "[A-Z]{2,4}-\\d{3,4}[A-Z]?", "name": "hyphenated_course_code"},
    {"pattern": "[A-Z]{2,4}\\s*\\d{2,4}[A-Z]?\\s*[A-Z]?", "name": "flexible_course_code"},
    {"pattern": "[A-Z]{2,4}\\s*\\d{3,4}\\s*[A-Z]{1,2}", "name": "department_course_code"}
  ],
  "grades": [
    {"pattern": "[A-Z][+-]?", "name": "letter_grade"},
    {"pattern": "\\d+\\.\\d+", "name": "numeric_grade"},
    {"pattern": "P|F|I|W|S|U", "name": "special_grade"},
    {"pattern": "[A-Z][+-]?\\s*\\([A-Z][+-]?\\)", "name": "parenthetical_grade"}
  ],
  "credits": [
    {"pattern": "\\(\\d+(?:\\.\\d+)?\\s*credits?\\)", "name": "parenthetical_credits"},
    {"pattern": "\\d+(?:\\.\\d+)?\\s*cr", "name": "abbreviated_credits"},
    {"pattern": "\\d+(?:\\.\\d+)?\\s*credit", "name": "singular_credit"}
  ],
  "coursePatterns": [
    // NEW: Specific patterns for transcript format
    {"pattern": "([A-Z]{2,4}\\d{3,4}[A-Z]?)\\s+([A-Za-z\\s-]+?)\\s+(\\d+)\\s+([A-Z][+-]?)", "name": "code_title_credits_grade"},
    {"pattern": "([A-Z]{2,4}\\d{3,4}[A-Z]?)\\s+([A-Za-z\\s-]+?)\\s+([A-Z][+-]?)", "name": "code_title_grade"},
    {"pattern": "([A-Za-z\\s-]+?)\\s+(\\d+)\\s+([A-Z][+-]?)", "name": "title_credits_grade"},
    {"pattern": "([A-Za-z\\s-]+?)\\s+([A-Z][+-]?)", "name": "title_grade"},
    // Original patterns
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s*[-–]\\s*([^(]+?)\\s*\\((\\d+(?:\\.\\d+)?)\\s*credits?\\)\\s*([A-Z][+-]?)", "name": "full_course_with_credits"},
    {"pattern": "([^(]+?)\\s*\\((\\d+(?:\\.\\d+)?)\\s*credits?\\)\\s*([A-Z][+-]?)", "name": "title_credits_grade_original"},
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s+([A-Z][a-z\\s]+)\\s+([A-Z][+-]?)", "name": "code_title_grade_original"},
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s*[-–]\\s*([A-Za-z\\s]+?)\\s+([A-Z][+-]?)", "name": "code_title_grade_no_credits"},
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s*[-–]\\s*([A-Za-z\\s]+)", "name": "code_title_only"},
    {"pattern": "(\\d+)\\.\\s*([A-Za-z\\s]+)", "name": "numbered_title"},
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s+([A-Za-z\\s]+)", "name": "code_title_space"},
    // Flexible patterns for various transcript formats
    {"pattern": "([A-Za-z\\s]+)\\s*[-–]\\s*([A-Z][+-]?)", "name": "title_dash_grade"},
    {"pattern": "([A-Za-z\\s]+)\\s+([A-Z][+-]?)", "name": "title_space_grade"},
    {"pattern": "([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s*[-–]\\s*([A-Za-z\\s]+)", "name": "code_dash_title"},
    {"pattern": "([A-Za-z\\s]+)\\s*\\(([A-Z][+-]?)\\)", "name": "title_parenthetical_grade"},
    {"pattern": "([A-Za-z\\s]+)\\s*\\|\\s*([A-Z][+-]?)", "name": "title_pipe_grade"},
  ]
};

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

// Multi-pass course extraction with enhanced patterns
export const extractCoursesWithMultiPass = internalMutation({
  args: {
    transcriptText: v.string(),
    gradeThreshold: v.string(),
    institution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExtractedCourse[]> => {
    console.log("[Enhanced Extraction] Starting multi-pass extraction");
    console.log("[Enhanced Extraction] Text length:", args.transcriptText.length);
    
    const lines = preprocessText(args.transcriptText);
    const extractedCourses: ExtractedCourse[] = [];
    const processedLines = new Set<number>();

    // Pass 1: Standard regex patterns
    console.log("[Enhanced Extraction] Pass 1: Standard regex patterns");
    const pass1Results = await extractWithRegexPatterns(ctx, lines, args.gradeThreshold, args.institution);
    extractedCourses.push(...pass1Results);
    
    // Mark lines as processed based on successful extractions
    for (let i = 0; i < lines.length; i++) {
      for (const course of pass1Results) {
        // If this line contains the course title or code, mark it as processed
        if (course.title && lines[i].includes(course.title)) {
          processedLines.add(i);
          break;
        }
        if (course.code && lines[i].includes(course.code)) {
          processedLines.add(i);
          break;
        }
      }
    }

    // Pass 2: Fuzzy matching for missed courses (only if we found fewer than expected)
    console.log("[Enhanced Extraction] Pass 2: Fuzzy matching");
    if (pass1Results.length < 16) { // Only use fuzzy matching if we're missing courses
      const pass2Results = await extractWithFuzzyMatching(ctx, lines, args.gradeThreshold, args.institution, processedLines);
      extractedCourses.push(...pass2Results);
    }

    // Pass 3: AI-assisted extraction for complex cases
    console.log("[Enhanced Extraction] Pass 3: AI-assisted extraction");
    const remainingText = getUnprocessedText(lines, processedLines);
    if (remainingText.length > 100) { // Only use AI if there's substantial unprocessed text
      // Note: AI extraction is handled separately as it requires an action
      // For now, we'll skip AI extraction in the mutation and handle it in the calling code
      console.log("[Enhanced Extraction] Skipping AI extraction in mutation (requires action)");
    }

    // Pass 4: Grade normalization and filtering
    console.log("[Enhanced Extraction] Pass 4: Grade normalization and filtering");
    const normalizedCourses = await normalizeAndFilterCourses(ctx, extractedCourses, args.gradeThreshold, args.institution);

    console.log(`[Enhanced Extraction] Final result: ${normalizedCourses.length} courses extracted`);
    return normalizedCourses;
  },
});

// Preprocess text for better extraction
function preprocessText(text: string): string[] {
  console.log("[Preprocessing] Original text length:", text.length);
  console.log("[Preprocessing] First 500 characters:", text.slice(0, 500));
  
  // Clean up common OCR artifacts but preserve line breaks
  let cleanedText = text
    .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters
    .replace(/\|/g, 'I') // Common OCR mistake
    .replace(/0/g, 'O') // Common OCR mistake for course codes
    .trim();

  // Split into lines and clean each line individually
  const lines = cleanedText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 3); // Remove very short lines

  console.log("[Preprocessing] Lines after basic filtering:", lines.length);

  // Filter out common headers and metadata (less aggressive)
  const filteredLines = lines.filter(line => {
    const lineLower = line.toLowerCase();
    
    // Skip common headers and metadata (only exact matches)
    const headerPatterns = [
      /^academic transcript$/i,
      /^student name:$/i,
      /^roll number:$/i,
      /^program:$/i,
      /^semester:$/i,
      /^total credits:$/i,
      /^gpa:$/i,
      /^grade point average:$/i,
      /^university:$/i,
      /^college:$/i,
      /^department:$/i,
      /^date:$/i,
      /^signature:$/i,
      /^official transcript$/i,
      /^course completion record$/i,
      /^transcript of records$/i,
    ];
    
    // Skip if line matches any header pattern exactly
    if (headerPatterns.some(pattern => pattern.test(line))) {
      console.log("[Preprocessing] Skipping header line:", line);
      return false;
    }
    
    // Skip lines that are mostly special characters or numbers (less strict)
    const alphanumericRatio = (line.match(/[a-zA-Z0-9]/g) || []).length / line.length;
    if (alphanumericRatio < 0.2) { // Reduced from 0.3 to 0.2
      console.log("[Preprocessing] Skipping low alphanumeric line:", line);
      return false;
    }
    
    return true;
  });

  console.log("[Preprocessing] Lines after filtering:", filteredLines.length);
  console.log("[Preprocessing] Sample filtered lines:", filteredLines.slice(0, 5));

  return filteredLines;
}

// Extract courses using regex patterns
async function extractWithRegexPatterns(
  ctx: any,
  lines: string[], 
  gradeThreshold: string, 
  institution?: string
): Promise<ExtractedCourse[]> {
  const courses: ExtractedCourse[] = [];

  console.log("[Regex Patterns] Processing", lines.length, "lines");
  console.log("[Regex Patterns] Sample lines:", lines.slice(0, 3));

  for (const line of lines) {
    console.log("[Regex Patterns] Processing line:", line);
    
    for (const patternConfig of PATTERN_REGISTRY.coursePatterns) {
      const regex = new RegExp(patternConfig.pattern, 'i');
      const match = line.match(regex);
      
      if (match) {
        console.log("[Regex Patterns] Pattern matched:", patternConfig.name, "for line:", line);
        const course = parseCourseFromMatch(match, patternConfig.name, line);
        if (course && await validateCourse(ctx, course, gradeThreshold, institution)) {
          console.log("[Regex Patterns] Valid course found:", course.title);
          courses.push(course);
          break; // Move to next line once we find a match
        } else {
          console.log("[Regex Patterns] Course validation failed for:", course?.title);
        }
      }
    }
  }

  console.log("[Regex Patterns] Total courses found:", courses.length);
  return courses;
}

// Parse course from regex match
function parseCourseFromMatch(match: RegExpMatchArray, patternName: string, originalLine: string): ExtractedCourse | null {
  let title = '';
  let grade = '';
  let credits: number | undefined = undefined;
  let code: string | undefined = undefined;

  switch (patternName) {
    // NEW: Transcript-specific patterns
    case 'code_title_credits_grade':
      code = match[1];
      title = match[2].trim();
      credits = parseFloat(match[3]);
      grade = match[4];
      break;
    case 'code_title_grade':
      code = match[1];
      title = match[2].trim();
      grade = match[3];
      break;
    case 'title_credits_grade':
      title = match[1].trim();
      credits = parseFloat(match[2]);
      grade = match[3];
      break;
    case 'title_grade':
      title = match[1].trim();
      grade = match[2];
      break;
    // Original patterns
    case 'full_course_with_credits':
      code = match[1];
      title = `${match[1]} - ${match[2].trim()}`;
      credits = parseFloat(match[3]);
      grade = match[4];
      break;
    case 'title_credits_grade_original':
      title = match[1].trim();
      credits = parseFloat(match[2]);
      grade = match[3];
      break;
    case 'code_title_grade_original':
      code = match[1];
      title = `${match[1]} ${match[2].trim()}`;
      grade = match[3];
      break;
    case 'code_title_grade_no_credits':
      code = match[1];
      title = `${match[1]} - ${match[2].trim()}`;
      grade = match[3];
      break;
    case 'code_title_only':
      code = match[1];
      title = `${match[1]} - ${match[2].trim()}`;
      break;
    case 'numbered_title':
      title = match[2].trim();
      break;
    case 'code_title_space':
      code = match[1];
      title = `${match[1]} ${match[2].trim()}`;
      break;
    // Flexible patterns for various transcript formats
    case 'title_dash_grade':
      title = match[1].trim();
      grade = match[2];
      break;
    case 'title_space_grade':
      title = match[1].trim();
      grade = match[2];
      break;
    case 'code_dash_title':
      code = match[1];
      title = `${match[1]} - ${match[2].trim()}`;
      break;
    case 'title_parenthetical_grade':
      title = match[1].trim();
      grade = match[2];
      break;
    case 'title_pipe_grade':
      title = match[1].trim();
      grade = match[2];
      break;
  }

  if (title.length < 3) return null;

  return {
    title,
    description: generateBasicCourseDescription(title, code),
    grade,
    credits,
    code,
    confidence: 0.9, // High confidence for regex matches
    extractionMethod: "regex" as const,
  };
}

// Fuzzy matching for courses that don't match standard patterns
async function extractWithFuzzyMatching(
  ctx: any,
  lines: string[], 
  gradeThreshold: string, 
  institution?: string,
  processedLines?: Set<number>
): Promise<ExtractedCourse[]> {
  const courses: ExtractedCourse[] = [];

  // Keywords that indicate non-course content
  const nonCourseKeywords = [
    'academic transcript', 'student name', 'roll number', 'program', 'semester',
    'total credits', 'gpa', 'grade point', 'university', 'college', 'department',
    'date', 'signature', 'official', 'transcript', 'record', 'completion'
  ];

  for (let i = 0; i < lines.length; i++) {
    if (processedLines?.has(i)) continue;

    const line = lines[i];
    const lineLower = line.toLowerCase();
    
    // Skip lines that contain non-course keywords
    if (nonCourseKeywords.some(keyword => lineLower.includes(keyword))) {
      continue;
    }
    
    // Look for grade indicators at the end of the line
    const gradeMatch = line.match(/\b([A-Z][+-]?)\s*$/);
    if (gradeMatch) {
      const grade = gradeMatch[1];
      
      // Extract potential course title (everything before the grade)
      const title = line.substring(0, line.indexOf(grade)).trim();
      
      // Additional validation for course titles
      if (title.length > 5 && title.length < 100) { // More reasonable length for course titles
        // Skip if title contains too many special characters or looks like metadata
        const specialCharRatio = (title.match(/[^a-zA-Z0-9\s\-\.]/g) || []).length / title.length;
        if (specialCharRatio > 0.2) continue; // More strict special character ratio
        
        // Skip if title looks like a header or metadata
        if (title.includes(':') && title.split(':').length > 2) continue;
        if (title.includes('[') && title.includes(']')) continue;
        if (title.includes('(') && title.includes(')')) continue;
        
        // Skip if title is too short or looks like a partial course
        if (title.split(' ').length < 2) continue;
        if (title.endsWith('-') || title.endsWith('|')) continue;
        
        // Try to extract course code
        const codeMatch = title.match(/\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b/);
        const code = codeMatch ? codeMatch[1] : undefined;
        
        // Skip if no course code found (likely not a real course)
        if (!code) continue;
        
        const course: ExtractedCourse = {
          title,
          description: generateBasicCourseDescription(title, code),
          grade,
          code,
          confidence: 0.7, // Medium confidence for fuzzy matches
          extractionMethod: "fuzzy" as const,
        };

        if (await validateCourse(ctx, course, gradeThreshold, institution)) {
          courses.push(course);
        }
      }
    }
  }

  return courses;
}

// AI-assisted extraction for complex cases
export const extractWithAI = internalAction({
  args: {
    text: v.string(),
    gradeThreshold: v.string(),
    institution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExtractedCourse[]> => {
    try {
      // Mask PII before sending to AI
      const maskedText = maskPII(args.text);
      
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

      const prompt = `Extract course information from this transcript text. Return only valid courses with grades at or above ${args.gradeThreshold}.

Text: ${maskedText}

Return a JSON array of courses with this structure:
[
  {
    "title": "Course Code - Course Title",
    "grade": "A",
    "credits": 3,
    "code": "CS101"
  }
]

Only include courses that have valid grades and meet the threshold.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting course information from academic transcripts. Return only valid courses with proper grades."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) return [];

      // Parse AI response
      const aiCourses = JSON.parse(content);
      return aiCourses.map((course: any) => ({
        title: course.title,
        description: generateBasicCourseDescription(course.title, course.code),
        grade: course.grade,
        credits: course.credits,
        code: course.code,
        confidence: 0.6, // Lower confidence for AI extraction
        extractionMethod: "ai" as const,
      }));

    } catch (error) {
      console.warn("[AI Extraction] Failed:", error);
      return [];
    }
  },
});

// Mask PII before sending to AI
function maskPII(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
    .replace(/\b[A-Z]{2}\d{2}[A-Z]{2}\d{4}\b/g, '[ID]');
}

// Get unprocessed text for AI extraction
function getUnprocessedText(lines: string[], processedLines: Set<number>): string {
  return lines
    .filter((_, index) => !processedLines.has(index))
    .join('\n');
}

// Validate course against grade threshold
async function validateCourse(
  ctx: any,
  course: ExtractedCourse, 
  gradeThreshold: string, 
  institution?: string
): Promise<boolean> {
  if (!course.grade) {
    console.log("[Validation] Course rejected - no grade:", course.title);
    return false;
  }
  
  console.log("[Validation] Validating course:", course.title, "with grade:", course.grade, "against threshold:", gradeThreshold);
  
  // Use the enhanced grade validation
  const gradeValidation = await ctx.runMutation(internal.gradeNormalization.validateGradeAgainstThreshold, {
    grade: course.grade,
    threshold: gradeThreshold,
    institution,
  });
  
  console.log("[Validation] Grade validation result:", gradeValidation);
  
  return gradeValidation.meetsThreshold;
}

// Normalize and filter courses
async function normalizeAndFilterCourses(
  ctx: any,
  courses: ExtractedCourse[], 
  gradeThreshold: string, 
  institution?: string
): Promise<ExtractedCourse[]> {
  const normalizedCourses: ExtractedCourse[] = [];
  
  for (const course of courses) {
    const gradeResult = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
      grade: course.grade,
      institution,
    });
    
    if (gradeResult.isValid) {
      normalizedCourses.push({
        ...course,
        grade: gradeResult.normalizedGrade,
      });
    }
  }
  
  // Remove duplicates based on title similarity
  return removeDuplicateCourses(normalizedCourses);
}

// Remove duplicate courses based on title similarity
function removeDuplicateCourses(courses: ExtractedCourse[]): ExtractedCourse[] {
  const uniqueCourses: ExtractedCourse[] = [];
  const seenTitles = new Set<string>();
  const seenCodes = new Set<string>();
  
  for (const course of courses) {
    const normalizedTitle = course.title.toLowerCase().replace(/\s+/g, ' ').trim();
    const normalizedCode = course.code?.toLowerCase().replace(/\s+/g, '').trim();
    
    // Skip if we've seen this exact title or code before
    if (seenTitles.has(normalizedTitle)) {
      console.log("[Duplicate Removal] Skipping duplicate title:", course.title);
      continue;
    }
    
    if (normalizedCode && seenCodes.has(normalizedCode)) {
      console.log("[Duplicate Removal] Skipping duplicate code:", course.code);
      continue;
    }
    
    // Check for similar titles (fuzzy matching)
    let isDuplicate = false;
    for (const existingCourse of uniqueCourses) {
      const existingTitle = existingCourse.title.toLowerCase().replace(/\s+/g, ' ').trim();
      
      // If titles are very similar (90% similarity), consider it a duplicate
      if (normalizedTitle.length > 10 && existingTitle.length > 10) {
        const similarity = calculateSimilarity(normalizedTitle, existingTitle);
        if (similarity > 0.9) {
          console.log("[Duplicate Removal] Skipping similar title:", course.title, "similar to:", existingCourse.title);
          isDuplicate = true;
          break;
        }
      }
    }
    
    if (!isDuplicate) {
      seenTitles.add(normalizedTitle);
      if (normalizedCode) seenCodes.add(normalizedCode);
      uniqueCourses.push(course);
    }
  }
  
  return uniqueCourses;
}

// Calculate similarity between two strings (simple implementation)
function calculateSimilarity(str1: string, str2: string): number {
  const words1 = str1.split(' ');
  const words2 = str2.split(' ');
  
  const commonWords = words1.filter(word => words2.includes(word));
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords.length / totalWords;
}

// Generate basic course description
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
  } else {
    return `Course covering ${terms.join(' ')}. Provides foundational knowledge and practical skills in the subject area.`;
  }
}
