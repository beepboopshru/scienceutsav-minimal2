import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    limit: v.optional(v.number()),
    actionType: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    dateRange: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    let logsQuery = ctx.db.query("activityLogs").order("desc");

    const logs = await logsQuery.take(limit);

    // Filter by action type if provided
    let filteredLogs = logs;
    if (args.actionType && args.actionType !== "all") {
      filteredLogs = filteredLogs.filter(log => log.actionType === args.actionType);
    }

    // Filter by user if provided
    if (args.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === args.userId);
    }

    // Filter by date range if provided
    if (args.dateRange && args.dateRange !== "all") {
      const now = Date.now();
      let cutoffTime = 0;
      
      if (args.dateRange === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        cutoffTime = today.getTime();
      } else if (args.dateRange === "7days") {
        cutoffTime = now - (7 * 24 * 60 * 60 * 1000);
      } else if (args.dateRange === "30days") {
        cutoffTime = now - (30 * 24 * 60 * 60 * 1000);
      }
      
      filteredLogs = filteredLogs.filter(log => log._creationTime >= cutoffTime);
    }

    // Fetch user details for each log
    const logsWithUsers = await Promise.all(
      filteredLogs.map(async (log) => {
        const user = await ctx.db.get(log.userId);
        const performedByUser = log.performedBy ? await ctx.db.get(log.performedBy) : null;
        return {
          ...log,
          user,
          performedByUser,
        };
      })
    );

    return logsWithUsers;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    actionType: v.string(),
    details: v.string(),
    performedBy: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("activityLogs", args);
  },
});

export const deleteAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const logs = await ctx.db.query("activityLogs").collect();
    let count = 0;
    for (const log of logs) {
      await ctx.db.delete(log._id);
      count++;
    }
    return count;
  },
});
