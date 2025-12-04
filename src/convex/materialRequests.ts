import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { checkPermission, hasPermission } from "./permissions";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if user has permission to view requests
    await checkPermission(ctx, userId, "materialRequests", "view");

    // Check if user can approve requests (manager view)
    const canApprove = await hasPermission(ctx, userId, "materialRequests", "approve");

    let requests;
    if (canApprove) {
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
          requesterEmail: requester?.email || "No Email",
          reviewerName: reviewer?.name,
        };
      })
    );

    return { requests: enrichedRequests, isManager: canApprove };
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
    assignmentId: v.optional(v.id("assignments")),
    procurementJobId: v.optional(v.id("procurementJobs")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await checkPermission(ctx, userId, "materialRequests", "create");

    await ctx.db.insert("materialRequests", {
      userId,
      items: args.items,
      status: "pending",
      purpose: args.purpose,
      assignmentId: args.assignmentId,
      procurementJobId: args.procurementJobId,
    });
  },
});

export const approve = mutation({
  args: { requestId: v.id("materialRequests") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await checkPermission(ctx, userId, "materialRequests", "approve");

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
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await checkPermission(ctx, userId, "materialRequests", "reject");

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