import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Grade value mapping for comparison
const GRADE_VALUES = {
  'A+': 4.0, 'A': 4.0, 'A-': 3.7,
  'B+': 3.3, 'B': 3.0, 'B-': 2.7,
  'C+': 2.3, 'C': 2.0, 'C-': 1.7,
  'D+': 1.3, 'D': 1.0, 'D-': 0.7,
  'F': 0.0, 'P': 4.0, 'U': 0.0, 'I': 0.0, 'W': 0.0
  // Note: 'S' grades are explicitly excluded as they are not accepted
} as const;

// Grade comparison function
export const meetsGradeThreshold = internalMutation({
  args: {
    grade: v.string(),
    threshold: v.string(),
  },
  handler: async (ctx, args) => {
    const gradeValue = GRADE_VALUES[args.grade as keyof typeof GRADE_VALUES] || 0;
    const thresholdValue = GRADE_VALUES[args.threshold as keyof typeof GRADE_VALUES] || 0;
    return gradeValue >= thresholdValue;
  },
});

// Filter courses by grade threshold
export const filterCoursesByGrade = internalMutation({
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
  },
  handler: async (ctx, args) => {
    const thresholdValue = GRADE_VALUES[args.gradeThreshold as keyof typeof GRADE_VALUES] || 0;
    
    return args.courses.filter(course => {
      const gradeValue = GRADE_VALUES[course.grade as keyof typeof GRADE_VALUES] || 0;
      return gradeValue >= thresholdValue;
    });
  },
});

// Normalize grade format
export const normalizeGrade = internalMutation({
  args: {
    grade: v.string(),
  },
  handler: async (ctx, args) => {
    const grade = args.grade.trim().toUpperCase();
    
    // Handle common grade variations
    const gradeMap: Record<string, string> = {
      'A+': 'A+', 'A': 'A', 'A-': 'A-',
      'B+': 'B+', 'B': 'B', 'B-': 'B-',
      'C+': 'C+', 'C': 'C', 'C-': 'C-',
      'D+': 'D+', 'D': 'D', 'D-': 'D-',
      'F': 'F', 'P': 'P', 'U': 'U', 'I': 'I', 'W': 'W',
      // Note: 'S' grades are excluded as they are not accepted
      // Handle numeric grades
      '4.0': 'A', '3.7': 'A-', '3.3': 'B+', '3.0': 'B', '2.7': 'B-',
      '2.3': 'C+', '2.0': 'C', '1.7': 'C-', '1.3': 'D+', '1.0': 'D',
      '0.7': 'D-', '0.0': 'F',
    };
    
    return gradeMap[grade] || grade;
  },
});

// Validate grade format
export const validateGrade = internalMutation({
  args: {
    grade: v.string(),
  },
  handler: async (ctx, args) => {
    // Since we can't call internal mutations from within mutations, 
    // we'll implement the normalization logic directly here
    const grade = args.grade.trim().toUpperCase();
    
    // Handle common grade variations
    const gradeMap: Record<string, string> = {
      'A+': 'A+', 'A': 'A', 'A-': 'A-',
      'B+': 'B+', 'B': 'B', 'B-': 'B-',
      'C+': 'C+', 'C': 'C', 'C-': 'C-',
      'D+': 'D+', 'D': 'D', 'D-': 'D-',
      'F': 'F', 'P': 'P', 'U': 'U', 'I': 'I', 'W': 'W',
      // Note: 'S' grades are excluded as they are not accepted
      // Handle numeric grades
      '4.0': 'A', '3.7': 'A-', '3.3': 'B+', '3.0': 'B', '2.7': 'B-',
      '2.3': 'C+', '2.0': 'C', '1.7': 'C-', '1.3': 'D+', '1.0': 'D',
      '0.7': 'D-', '0.0': 'F',
    };
    
    const normalizedGrade = gradeMap[grade] || grade;
    
    // Explicitly reject 'S' grades
    if (normalizedGrade === 'S') {
      return false;
    }
    
    return GRADE_VALUES[normalizedGrade as keyof typeof GRADE_VALUES] !== undefined;
  },
});

// Calculate GPA for a set of courses
export const calculateGPA = internalMutation({
  args: {
    courses: v.array(v.object({
      title: v.string(),
      description: v.string(),
      grade: v.string(),
      credits: v.optional(v.number()),
      semester: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    let totalPoints = 0;
    let totalCredits = 0;
    
    for (const course of args.courses) {
      const gradeValue = GRADE_VALUES[course.grade as keyof typeof GRADE_VALUES] || 0;
      const credits = course.credits || 3; // Default to 3 credits if not specified
      
      totalPoints += gradeValue * credits;
      totalCredits += credits;
    }
    
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  },
}); 