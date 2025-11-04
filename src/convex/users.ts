import { getAuthUserId } from "@convex-dev/auth/server";
import { query, QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { roleValidator } from "./schema";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter(user => !user.isApproved && !user.isAnonymous);
  },
});

export const listApproved = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.filter(user => user.isApproved);
  },
});

export const approveUser = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    await ctx.db.patch(args.userId, {
      isApproved: true,
      role: args.role,
    });

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: args.userId,
      actionType: "user_approved",
      details: `User approved with role: ${args.role}`,
      performedBy: adminId,
    });
  },
});

export const updateRole = mutation({
  args: {
    userId: v.id("users"),
    role: roleValidator,
  },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    if (adminId === args.userId) {
      throw new Error("Cannot change your own role");
    }

    const user = await ctx.db.get(args.userId);
    const oldRole = user?.role;

    await ctx.db.patch(args.userId, { role: args.role });

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: args.userId,
      actionType: "role_changed",
      details: `Role changed from ${oldRole} to ${args.role}`,
      performedBy: adminId,
    });
  },
});

export const deleteUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    if (adminId === args.userId) {
      throw new Error("Cannot delete your own account");
    }

    const user = await ctx.db.get(args.userId);
    
    await ctx.db.delete(args.userId);

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      actionType: "user_deleted",
      details: `Deleted user: ${user?.email || user?.name || "Unknown"}`,
      performedBy: adminId,
    });
  },
});

export const clearPendingAssignments = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    const assignments = await ctx.db.query("assignments").collect();
    const pendingAssignments = assignments.filter(
      a => a.status === "assigned" || a.status === "packed"
    );

    let count = 0;
    for (const assignment of pendingAssignments) {
      // Restore stock
      const kit = await ctx.db.get(assignment.kitId);
      if (kit) {
        const newStockCount = kit.stockCount + assignment.quantity;
        await ctx.db.patch(assignment.kitId, {
          stockCount: newStockCount,
          status: newStockCount > 0 ? "in_stock" : "to_be_made",
        });
      }
      
      await ctx.db.delete(assignment._id);
      count++;
    }

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      actionType: "assignments_cleared",
      details: `Cleared ${count} pending assignments`,
      performedBy: adminId,
    });

    return count;
  },
});

export const clearAllAssignments = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    const assignments = await ctx.db.query("assignments").collect();

    let count = 0;
    for (const assignment of assignments) {
      // Only restore stock for non-dispatched assignments
      if (assignment.status !== "dispatched") {
        const kit = await ctx.db.get(assignment.kitId);
        if (kit) {
          const newStockCount = kit.stockCount + assignment.quantity;
          await ctx.db.patch(assignment.kitId, {
            stockCount: newStockCount,
            status: newStockCount > 0 ? "in_stock" : "to_be_made",
          });
        }
      }
      
      await ctx.db.delete(assignment._id);
      count++;
    }

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      actionType: "all_assignments_cleared",
      details: `Cleared all ${count} assignments`,
      performedBy: adminId,
    });

    return count;
  },
});