import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("processingJobs").collect();
  },
});

export const get = query({
  args: { id: v.id("processingJobs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByStatus = query({
  args: {
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("processingJobs")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    sourceItemId: v.id("inventory"),
    sourceQuantity: v.number(),
    targets: v.array(
      v.object({
        targetItemId: v.id("inventory"),
        targetQuantity: v.number(),
      })
    ),
    processedBy: v.optional(v.string()),
    processedByType: v.optional(v.union(v.literal("vendor"), v.literal("service"))),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Reserve source material
    const sourceItem = await ctx.db.get(args.sourceItemId);
    if (!sourceItem) throw new Error("Source item not found");
    if (sourceItem.quantity < args.sourceQuantity) {
      throw new Error("Insufficient source material quantity");
    }

    await ctx.db.patch(args.sourceItemId, {
      quantity: sourceItem.quantity - args.sourceQuantity,
    });

    return await ctx.db.insert("processingJobs", {
      ...args,
      status: "pending",
      createdBy: userId,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("processingJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");

    const updates: Record<string, unknown> = { status: args.status };

    if (args.status === "in_progress" && !job.startedAt) {
      updates.startedAt = Date.now();
    }

    if (args.status === "completed" && !job.completedAt) {
      updates.completedAt = Date.now();

      // Add target items to inventory
      for (const target of job.targets) {
        const targetItem = await ctx.db.get(target.targetItemId);
        if (targetItem) {
          await ctx.db.patch(target.targetItemId, {
            quantity: targetItem.quantity + target.targetQuantity,
          });
        }
      }
    }

    if (args.status === "cancelled") {
      // Return source material to inventory
      const sourceItem = await ctx.db.get(job.sourceItemId);
      if (sourceItem) {
        await ctx.db.patch(job.sourceItemId, {
          quantity: sourceItem.quantity + job.sourceQuantity,
        });
      }
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("processingJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");

    // If job is not completed or cancelled, return source material
    if (job.status === "pending" || job.status === "in_progress") {
      const sourceItem = await ctx.db.get(job.sourceItemId);
      if (sourceItem) {
        await ctx.db.patch(job.sourceItemId, {
          quantity: sourceItem.quantity + job.sourceQuantity,
        });
      }
    }

    await ctx.db.delete(args.id);
  },
});
