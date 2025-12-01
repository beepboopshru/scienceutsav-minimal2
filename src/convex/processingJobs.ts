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
      v.union(v.literal("assigned"), v.literal("in_progress"), v.literal("completed"))
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
    sources: v.array(
      v.object({
        sourceItemId: v.id("inventory"),
        sourceQuantity: v.number(),
      })
    ),
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

    // Allow creation with empty sources array
    return await ctx.db.insert("processingJobs", {
      ...args,
      status: "assigned",
      createdBy: userId,
    });
  },
});

export const startJob = mutation({
  args: {
    id: v.id("processingJobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Processing job not found");
    if (job.status !== "assigned") {
      throw new Error("Can only start jobs with 'assigned' status");
    }

    // Only validate and deduct source materials if sources exist
    if (job.sources && job.sources.length > 0) {
      const insufficientMaterials: string[] = [];
      for (const source of job.sources) {
        const sourceItem = await ctx.db.get(source.sourceItemId);
        if (!sourceItem) {
          throw new Error(`Source material not found: ${source.sourceItemId}`);
        }
        if (sourceItem.quantity < source.sourceQuantity) {
          insufficientMaterials.push(
            `${sourceItem.name}: Required ${source.sourceQuantity} ${sourceItem.unit}, Available ${sourceItem.quantity} ${sourceItem.unit}`
          );
        }
      }

      if (insufficientMaterials.length > 0) {
        throw new Error(
          `Insufficient stock for the following materials:\n${insufficientMaterials.join("\n")}`
        );
      }

      // Deduct source materials
      for (const source of job.sources) {
        const sourceItem = await ctx.db.get(source.sourceItemId);
        if (!sourceItem) throw new Error(`Source item not found: ${source.sourceItemId}`);

        await ctx.db.patch(source.sourceItemId, {
          quantity: sourceItem.quantity - source.sourceQuantity,
        });
      }
    }

    await ctx.db.patch(args.id, {
      status: "in_progress",
      startedAt: Date.now(),
      startedBy: userId,
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

    // Add target items to inventory (always happens regardless of sources)
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

    // Return source materials to inventory ONLY if job was "in_progress" and has sources
    if (job.status === "in_progress" && job.sources && job.sources.length > 0) {
      for (const source of job.sources) {
        const sourceItem = await ctx.db.get(source.sourceItemId);
        if (sourceItem) {
          await ctx.db.patch(source.sourceItemId, {
            quantity: sourceItem.quantity + source.sourceQuantity,
          });
        }
      }
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

    return await ctx.db.insert("deletionRequests", {
      entityType: "processingJob",
      entityId: args.id,
      entityName: job.name,
      status: "pending",
      requestedBy: userId,
      reason: "User requested deletion",
    });
  },
});