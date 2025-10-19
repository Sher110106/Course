import { query } from "./_generated/server";
import { v } from "convex/values";

// Get Plaksha courses
export const getPlakshaCourses = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("plakshaCourses").collect();
  },
});

// Get core requirement courses up to a specific semester
export const getCoreRequirementsBySemester = query({
  args: {
    maxSemester: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plakshaCourses")
      .withIndex("by_core", (q) => q.eq("isCoreRequirement", true))
      .filter((q) => q.lte(q.field("semester"), args.maxSemester))
      .collect();
  },
});

// Get core requirement courses
export const getCoreRequirements = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("plakshaCourses")
      .withIndex("by_core", (q) => q.eq("isCoreRequirement", true))
      .collect();
  },
});

// Get courses by semester
export const getCoursesBySemester = query({
  args: {
    semester: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("plakshaCourses")
      .filter((q) => q.eq(q.field("semester"), args.semester))
      .collect();
  },
});
