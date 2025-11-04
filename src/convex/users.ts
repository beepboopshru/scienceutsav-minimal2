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
    
    // Delete all user-created data
    // 1. Delete assignments created by user
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const assignment of assignments) {
      // Restore stock if not dispatched
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
    }

    // 2. Delete kits created by user
    const kits = await ctx.db
      .query("kits")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const kit of kits) {
      await ctx.db.delete(kit._id);
    }

    // 3. Delete programs created by user
    const programs = await ctx.db
      .query("programs")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const program of programs) {
      await ctx.db.delete(program._id);
    }

    // 4. Delete clients created by user
    const clients = await ctx.db
      .query("clients")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const client of clients) {
      await ctx.db.delete(client._id);
    }

    // 5. Delete vendors created by user
    const vendors = await ctx.db
      .query("vendors")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const vendor of vendors) {
      await ctx.db.delete(vendor._id);
    }

    // 6. Delete services created by user
    const services = await ctx.db
      .query("services")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const service of services) {
      await ctx.db.delete(service._id);
    }

    // 7. Delete processing jobs created by user
    const processingJobs = await ctx.db
      .query("processingJobs")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const job of processingJobs) {
      await ctx.db.delete(job._id);
    }

    // 8. Delete vendor imports created by user
    const vendorImports = await ctx.db
      .query("vendorImports")
      .withIndex("by_created_by", (q) => q.eq("createdBy", args.userId))
      .collect();
    for (const vendorImport of vendorImports) {
      await ctx.db.delete(vendorImport._id);
    }

    // 9. Delete activity logs related to user
    const activityLogs = await ctx.db
      .query("activityLogs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const log of activityLogs) {
      await ctx.db.delete(log._id);
    }

    // 10. Delete user permissions
    const userPermissions = await ctx.db
      .query("userPermissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const permission of userPermissions) {
      await ctx.db.delete(permission._id);
    }

    // 11. Delete auth-related records (accounts, sessions, verification codes, refresh tokens)
    // First, collect account IDs for this user
    const authAccounts = await ctx.db
      .query("authAccounts")
      .collect();
    const userAccountIds: Array<any> = [];
    for (const account of authAccounts) {
      if (account.userId === args.userId) {
        userAccountIds.push(account._id);
        await ctx.db.delete(account._id);
      }
    }

    // Delete sessions for this user
    const authSessions = await ctx.db
      .query("authSessions")
      .collect();
    const userSessionIds: Array<any> = [];
    for (const session of authSessions) {
      if (session.userId === args.userId) {
        userSessionIds.push(session._id);
        await ctx.db.delete(session._id);
      }
    }

    // Delete verification codes linked to user's accounts
    const authVerificationCodes = await ctx.db
      .query("authVerificationCodes")
      .collect();
    for (const code of authVerificationCodes) {
      if (code.accountId && userAccountIds.some(accId => accId === code.accountId)) {
        await ctx.db.delete(code._id);
      }
    }

    // Delete refresh tokens linked to user's sessions
    const authRefreshTokens = await ctx.db
      .query("authRefreshTokens")
      .collect();
    for (const token of authRefreshTokens) {
      if (token.sessionId && userSessionIds.some(sessId => sessId === token.sessionId)) {
        await ctx.db.delete(token._id);
      }
    }

    // Finally, delete the user
    await ctx.db.delete(args.userId);

    // Log the activity
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      actionType: "user_deleted",
      details: `Deleted user and all associated data: ${user?.email || user?.name || "Unknown"}`,
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