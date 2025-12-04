import { v } from "convex/values";
import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Get all material requests for a specific assignment
 */
export const getByAssignment = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const requests = await ctx.db
      .query("materialRequests")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .collect();

    return requests;
  },
});

/**
 * Get approved material request quantities by material name for an assignment
 */
export const getApprovedQuantitiesByAssignment = query({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const requests = await ctx.db
      .query("materialRequests")
      .withIndex("by_assignment", (q) => q.eq("assignmentId", args.assignmentId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    // Aggregate quantities by material name
    const quantitiesMap = new Map<string, number>();
    
    requests.forEach((request) => {
      request.items.forEach((item) => {
        const key = item.name.toLowerCase();
        const existing = quantitiesMap.get(key) || 0;
        quantitiesMap.set(key, existing + item.quantity);
      });
    });

    return Object.fromEntries(quantitiesMap);
  },
});

/**
 * Get all approved material requests across all assignments
 * Returns a map of material name -> total approved quantity
 */
export const getAllApprovedQuantities = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const approvedRequests = await ctx.db
      .query("materialRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    // Aggregate quantities by material name
    const quantitiesMap = new Map<string, number>();
    
    approvedRequests.forEach((request) => {
      request.items.forEach((item) => {
        const key = item.name.toLowerCase();
        const existing = quantitiesMap.get(key) || 0;
        quantitiesMap.set(key, existing + item.quantity);
      });
    });

    return Object.fromEntries(quantitiesMap);
  },
});
