import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Create a deletion request
export const create = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    entityName: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user) throw new Error("User not found");

    const requestId = await ctx.db.insert("deletionRequests", {
      entityType: args.entityType,
      entityId: args.entityId,
      entityName: args.entityName,
      reason: args.reason,
      status: "pending",
      requestedBy: user._id,
    });

    return requestId;
  },
});

// List all deletion requests
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    let requests;

    if (args.status) {
      const status = args.status;
      requests = await ctx.db
        .query("deletionRequests")
        .withIndex("by_status", (q) => q.eq("status", status))
        .collect();
    } else {
      requests = await ctx.db.query("deletionRequests").collect();
    }

    // Fetch user details for each request
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const requestedByUser = await ctx.db.get(request.requestedBy);
        const reviewedByUser = request.reviewedBy ? await ctx.db.get(request.reviewedBy) : null;

        return {
          ...request,
          requestedByUser,
          reviewedByUser,
        };
      })
    );

    return requestsWithUsers;
  },
});

// Approve a deletion request
export const approve = mutation({
  args: {
    requestId: v.id("deletionRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can approve deletion requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    if (request.status !== "pending") {
      throw new Error("Request has already been processed");
    }

    // Update the request status
    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
    });

    // Perform the actual deletion based on entity type
    await performDeletion(ctx, request.entityType, request.entityId);

    return { success: true };
  },
});

// Reject a deletion request
export const reject = mutation({
  args: {
    requestId: v.id("deletionRequests"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can reject deletion requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    if (request.status !== "pending") {
      throw new Error("Request has already been processed");
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      rejectionReason: args.rejectionReason,
    });

    return { success: true };
  },
});

// Helper function to perform actual deletion
async function performDeletion(ctx: any, entityType: string, entityId: string) {
  switch (entityType) {
    case "inventory":
      await ctx.db.delete(entityId as Id<"inventory">);
      break;
    case "client":
      await ctx.db.delete(entityId as Id<"clients">);
      break;
    case "b2cClient":
      await ctx.db.delete(entityId as Id<"b2cClients">);
      break;
    case "kit":
      await ctx.db.delete(entityId as Id<"kits">);
      break;
    case "vendor":
      await ctx.db.delete(entityId as Id<"vendors">);
      break;
    case "service":
      await ctx.db.delete(entityId as Id<"services">);
      break;
    case "assignment":
      await ctx.db.delete(entityId as Id<"assignments">);
      break;
    case "processingJob":
      await ctx.db.delete(entityId as Id<"processingJobs">);
      break;
    case "procurementJob":
      await ctx.db.delete(entityId as Id<"procurementJobs">);
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// Delete a deletion request (for cleanup)
export const remove = mutation({
  args: {
    requestId: v.id("deletionRequests"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can delete requests");
    }

    await ctx.db.delete(args.requestId);
    return { success: true };
  },
});