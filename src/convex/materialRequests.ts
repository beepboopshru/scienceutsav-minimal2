import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Check if user has inventory management permissions (manager)
    // We'll check if they have the 'inventory' role or specific permissions
    // For now, let's assume 'manager', 'admin', 'inventory', 'operations' roles can view all
    const isManager = 
      user.role === "admin" || 
      user.role === "manager" || 
      user.role === "inventory" || 
      user.role === "operations";

    let requests;
    if (isManager) {
      requests = await ctx.db.query("materialRequests").order("desc").collect();
    } else {
      requests = await ctx.db
        .query("materialRequests")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .collect();
    }

    // Enrich with user details
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const requester = await ctx.db.get(req.userId);
        const reviewer = req.reviewedBy ? await ctx.db.get(req.reviewedBy) : null;
        return {
          ...req,
          requesterName: requester?.name || "Unknown User",
          reviewerName: reviewer?.name,
        };
      })
    );

    return { requests: enrichedRequests, isManager };
  },
});

export const create = mutation({
  args: {
    items: v.array(
      v.object({
        inventoryId: v.id("inventory"),
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
      })
    ),
    purpose: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.insert("materialRequests", {
      userId,
      items: args.items,
      status: "pending",
      purpose: args.purpose,
    });
  },
});

export const approve = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    // Basic permission check - in a real app, use the permissions system
    const canApprove = 
      user?.role === "admin" || 
      user?.role === "manager" || 
      user?.role === "inventory" || 
      user?.role === "operations";

    if (!canApprove) throw new Error("Unauthorized to approve requests");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") throw new Error("Request is not pending");

    // Verify stock and deduct
    for (const item of request.items) {
      const inventoryItem = await ctx.db.get(item.inventoryId);
      if (!inventoryItem) {
        throw new Error(`Item ${item.name} not found in inventory`);
      }
      if (inventoryItem.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Requested: ${item.quantity}, Available: ${inventoryItem.quantity}`);
      }

      // Deduct stock
      await ctx.db.patch(item.inventoryId, {
        quantity: inventoryItem.quantity - item.quantity,
      });
    }

    // Update request status
    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
  },
});

export const reject = mutation({
  args: { 
    requestId: v.id("materialRequests"),
    reason: v.optional(v.string()) // Optional rejection reason if we want to add it later to schema, but for now schema doesn't have it, so we'll just mark rejected.
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    const canReject = 
      user?.role === "admin" || 
      user?.role === "manager" || 
      user?.role === "inventory" || 
      user?.role === "operations";

    if (!canReject) throw new Error("Unauthorized to reject requests");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") throw new Error("Request is not pending");

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
  },
});
