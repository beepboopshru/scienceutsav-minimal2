import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Debug utility: List all auth accounts with their associated user status
 */
export const listAuthAccounts = query({
  args: {},
  handler: async (ctx) => {
    const accounts = await ctx.db.query("authAccounts").collect();
    
    const accountsWithUserStatus = await Promise.all(
      accounts.map(async (account) => {
        const user = await ctx.db.get(account.userId);
        return {
          accountId: account._id,
          userId: account.userId,
          userExists: user !== null,
          userEmail: user?.email,
        };
      })
    );
    
    return accountsWithUserStatus;
  },
});

/**
 * Admin utility: Clean up orphaned auth records
 * This removes auth accounts that reference non-existent users
 */
export const cleanupOrphanedAuthRecords = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    let cleanedCount = 0;

    // Find and delete orphaned auth accounts
    const authAccounts = await ctx.db.query("authAccounts").collect();
    for (const account of authAccounts) {
      const user = await ctx.db.get(account.userId);
      if (!user) {
        await ctx.db.delete(account._id);
        cleanedCount++;
      }
    }

    // Find and delete orphaned auth sessions
    const authSessions = await ctx.db.query("authSessions").collect();
    for (const session of authSessions) {
      const user = await ctx.db.get(session.userId);
      if (!user) {
        await ctx.db.delete(session._id);
        cleanedCount++;
      }
    }

    // Log the cleanup
    await ctx.db.insert("activityLogs", {
      userId: adminId,
      actionType: "auth_cleanup",
      details: `Cleaned up ${cleanedCount} orphaned auth records`,
      performedBy: adminId,
    });

    return cleanedCount;
  },
});
