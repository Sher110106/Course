import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// Get current user's saved courses
export const getUserCourses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("userCourses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

// Add a course for the current user
export const addUserCourse = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    institution: v.optional(v.string()),
    credits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await ctx.db.insert("userCourses", { ...args, userId });
    return null;
  },
});

// Update an existing user course (owned by the current user)
export const updateUserCourse = mutation({
  args: {
    id: v.id("userCourses"),
    title: v.string(),
    description: v.string(),
    institution: v.optional(v.string()),
    credits: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const { id, ...rest } = args;
    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, rest);
    return null;
  },
});

// Delete a user course (owned by the current user)
export const deleteUserCourse = mutation({
  args: {
    id: v.id("userCourses"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db.get(args.id);
    if (!existing || existing.userId !== userId) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return null;
  },
});
