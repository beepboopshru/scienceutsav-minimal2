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
    status: v.optional(
      v.union(v.literal("in_progress"), v.literal("completed"))
    ),
  },
  handler: async (ctx, args) => {
    if (args.status !== undefined) {
      return await ctx.db
        .query("processingJobs")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    }
    return await ctx.db.query("processingJobs").collect();
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
    processedByType: v.optional(v.union(v.literal("vendor"), v.literal("service"), v.literal("in_house"))),
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
      status: "in_progress",
      createdBy: userId,
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("processingJobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");
    if (job.status === "completed") {
      throw new Error("Job already completed");
    }

    // Add target items to inventory
    for (const target of job.targets) {
      const targetItem = await ctx.db.get(target.targetItemId);
      if (targetItem) {
        await ctx.db.patch(target.targetItemId, {
          quantity: targetItem.quantity + target.targetQuantity,
        });
      }
    }

    await ctx.db.patch(args.id, {
      status: "completed",
      completedAt: Date.now(),
      completedBy: userId,
    });
  },
});

export const cancel = mutation({
  args: { id: v.id("processingJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");
    if (job.status === "completed") {
      throw new Error("Cannot cancel completed job");
    }

    // Return source material to inventory
    const sourceItem = await ctx.db.get(job.sourceItemId);
    if (sourceItem) {
      await ctx.db.patch(job.sourceItemId, {
        quantity: sourceItem.quantity + job.sourceQuantity,
      });
    }

    await ctx.db.delete(args.id);
  },
});

export const remove = mutation({
  args: { id: v.id("processingJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");

    // If job is not completed, return source material
    if (job.status === "in_progress") {
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