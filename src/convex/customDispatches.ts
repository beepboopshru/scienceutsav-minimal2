import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    description: v.string(),
    status: v.union(v.literal("pending"), v.literal("dispatched"), v.literal("delivered")),
    trackingNumber: v.optional(v.string()),
    recipientName: v.optional(v.string()),
    remarks: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const customDispatchId = await ctx.db.insert("customDispatches", {
      description: args.description,
      status: args.status,
      trackingNumber: args.trackingNumber,
      recipientName: args.recipientName,
      remarks: args.remarks,
      createdBy: user._id,
      createdByName: user.name || user.email || "Unknown",
    });

    await ctx.db.insert("activityLogs", {
      actionType: "custom_dispatch_created",
      userId: user._id,
      details: `Created custom dispatch: ${args.description}`,
    });

    return customDispatchId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const customDispatches = await ctx.db
      .query("customDispatches")
      .order("desc")
      .collect();

    return customDispatches;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("customDispatches"),
    status: v.union(v.literal("pending"), v.literal("dispatched"), v.literal("delivered")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
    });

    await ctx.db.insert("activityLogs", {
      actionType: "custom_dispatch_status_updated",
      userId: user._id,
      details: `Updated custom dispatch status to: ${args.status}`,
    });
  },
});

export const deleteCustomDispatch = mutation({
  args: {
    id: v.id("customDispatches"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.delete(args.id);

    await ctx.db.insert("activityLogs", {
      actionType: "custom_dispatch_deleted",
      userId: user._id,
      details: `Deleted custom dispatch`,
    });
  },
});