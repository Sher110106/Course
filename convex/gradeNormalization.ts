import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Grade value mapping for 4.0 scale
const GRADE_VALUES_4_0 = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0, 'P': 4.0, 'U': 0.0, 'I': 0.0, 'W': 0.0
  // Note: 'S' grades are explicitly excluded as they are not accepted
} as const;

// Institution-specific grade configurations
const INSTITUTION_GRADE_CONFIGS = {
  "default": {
    institution: "default",
    gradeMappings: GRADE_VALUES_4_0,
    thresholdDefaults: {
      "A": 3.7,
      "B": 3.0,
      "C": 2.0,
      "D": 1.0
    }
  },
  "plaksha": {
    institution: "plaksha",
    gradeMappings: {
      ...GRADE_VALUES_4_0,
      // Add Plaksha-specific grade mappings if needed
    },
    thresholdDefaults: {
      "A": 3.7,
      "B": 3.0,
      "C": 2.0,
      "D": 1.0
    }
  }
} as const;

export interface GradeConfig {
  institution: string;
  gradeMappings: Record<string, number>;
  thresholdDefaults: Record<string, number>;
}

// Normalize grade to 4.0 scale
export const normalizeGrade = internalMutation({
  args: {
    grade: v.string(),
    institution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    normalizedGrade: string;
    numericValue: number;
    isValid: boolean;
  }> => {
    const grade = args.grade.trim().toUpperCase();
    const institution = args.institution || "default";
    const config = INSTITUTION_GRADE_CONFIGS[institution as keyof typeof INSTITUTION_GRADE_CONFIGS] || INSTITUTION_GRADE_CONFIGS.default;

    console.log("[Grade Normalization] Processing grade:", grade, "for institution:", institution);

    // Handle numeric grades
    if (/^\d+\.\d+$/.test(grade)) {
      const numericValue = parseFloat(grade);
      if (numericValue >= 0 && numericValue <= 4.0) {
        console.log("[Grade Normalization] Numeric grade:", numericValue);
        return {
          normalizedGrade: grade,
          numericValue,
          isValid: true
        };
      }
    }

    // Handle letter grades with variations
    const normalizedGrade = normalizeGradeFormat(grade);
    
    // Explicitly reject 'S' grades
    if (normalizedGrade === 'S') {
      console.log("[Grade Normalization] Rejecting 'S' grade:", grade);
      return {
        normalizedGrade: 'S',
        numericValue: 0,
        isValid: false
      };
    }
    
    const numericValue = config.gradeMappings[normalizedGrade as keyof typeof GRADE_VALUES_4_0] || 0;

    console.log("[Grade Normalization] Normalized grade:", normalizedGrade, "numeric value:", numericValue);

    return {
      normalizedGrade,
      numericValue,
      isValid: numericValue > 0 || normalizedGrade === 'P'
    };
  },
});

// Normalize grade format
function normalizeGradeFormat(grade: string): string {
  // Clean up the grade string
  const cleanGrade = grade.trim().toUpperCase();
  
  // Handle common grade variations
  const gradeMap: Record<string, string> = {
    'A+': 'A+', 'A': 'A', 'A-': 'A-',
    'B+': 'B+', 'B': 'B', 'B-': 'B-',
    'C+': 'C+', 'C': 'C', 'C-': 'C-',
    'D+': 'D+', 'D': 'D', 'D-': 'D-',
    'F': 'F', 'P': 'P', 'S': 'S', 'U': 'U', 'I': 'I', 'W': 'W',
    // Note: 'S' grades are normalized but will be rejected during validation
    // Handle numeric grades
    '4.0': 'A', '3.7': 'A-', '3.3': 'B+', '3.0': 'B', '2.7': 'B-',
    '2.3': 'C+', '2.0': 'C', '1.7': 'C-', '1.3': 'D+', '1.0': 'D',
    '0.7': 'D-', '0.0': 'F',
  };
  
  // First try exact match
  if (gradeMap[cleanGrade]) {
    return gradeMap[cleanGrade];
  }
  
  // Try to match with common variations
  const variations = [
    { pattern: /^A\s*\+$/, grade: 'A+' },
    { pattern: /^A\s*-\s*$/, grade: 'A-' },
    { pattern: /^A$/, grade: 'A' },
    { pattern: /^B\s*\+$/, grade: 'B+' },
    { pattern: /^B\s*-\s*$/, grade: 'B-' },
    { pattern: /^B$/, grade: 'B' },
    { pattern: /^C\s*\+$/, grade: 'C+' },
    { pattern: /^C\s*-\s*$/, grade: 'C-' },
    { pattern: /^C$/, grade: 'C' },
    { pattern: /^D\s*\+$/, grade: 'D+' },
    { pattern: /^D\s*-\s*$/, grade: 'D-' },
    { pattern: /^D$/, grade: 'D' },
    { pattern: /^F$/, grade: 'F' },
    { pattern: /^P$/, grade: 'P' },
    { pattern: /^S$/, grade: 'S' },
    { pattern: /^U$/, grade: 'U' },
    // Note: 'S' grades are normalized but will be rejected during validation
    { pattern: /^I$/, grade: 'I' },
    { pattern: /^W$/, grade: 'W' },
  ];
  
  for (const variation of variations) {
    if (variation.pattern.test(cleanGrade)) {
      return variation.grade;
    }
  }
  
  return cleanGrade;
}

// Validate grade against threshold
export const validateGradeAgainstThreshold = internalMutation({
  args: {
    grade: v.string(),
    threshold: v.string(),
    institution: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    meetsThreshold: boolean;
    gradeValue: number;
    thresholdValue: number;
  }> => {
    const gradeResult = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
      grade: args.grade,
      institution: args.institution,
    });

    const thresholdResult = await ctx.runMutation(internal.gradeNormalization.normalizeGrade, {
      grade: args.threshold,
      institution: args.institution,
    });

    return {
      meetsThreshold: gradeResult.numericValue >= thresholdResult.numericValue,
      gradeValue: gradeResult.numericValue,
      thresholdValue: thresholdResult.numericValue,
    };
  },
});

// Get institution-specific grade configuration
export const getGradeConfig = internalMutation({
  args: {
    institution: v.string(),
  },
  handler: async (ctx, args): Promise<GradeConfig | null> => {
    const config = INSTITUTION_GRADE_CONFIGS[args.institution as keyof typeof INSTITUTION_GRADE_CONFIGS];
    return config ? config as GradeConfig : null;
  },
});

// Convert grade to letter grade
export const convertToLetterGrade = internalMutation({
  args: {
    numericGrade: v.number(),
  },
  handler: async (ctx, args): Promise<string> => {
    const grade = args.numericGrade;
    
    if (grade >= 3.7) return 'A';
    if (grade >= 3.3) return 'B+';
    if (grade >= 3.0) return 'B';
    if (grade >= 2.7) return 'B-';
    if (grade >= 2.3) return 'C+';
    if (grade >= 2.0) return 'C';
    if (grade >= 1.7) return 'C-';
    if (grade >= 1.3) return 'D+';
    if (grade >= 1.0) return 'D';
    if (grade >= 0.7) return 'D-';
    return 'F';
  },
});

// Enhanced grade filtering with normalization
export const filterCoursesByGradeWithNormalization = internalMutation({
  args: {
    courses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
      code: v.optional(v.string()),
    })),
    gradeThreshold: v.string(),
    institution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const filteredCourses = [];
    
    for (const course of args.courses) {
      const gradeValidation = await ctx.runMutation(internal.gradeNormalization.validateGradeAgainstThreshold, {
        grade: course.grade,
        threshold: args.gradeThreshold,
        institution: args.institution,
      });
      
      if (gradeValidation.meetsThreshold) {
        filteredCourses.push(course);
      }
    }
    
    return filteredCourses;
  },
});
