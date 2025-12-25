import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

export const list = query({
  args: { clientType: v.optional(v.union(v.literal("b2b"), v.literal("b2c"))) },
  handler: async (ctx, args) => {
    let batches;
    if (args.clientType) {
      batches = await ctx.db
        .query("batches")
        .withIndex("by_clientType", (q) => q.eq("clientType", args.clientType!))
        .collect();
    } else {
      batches = await ctx.db.query("batches").collect();
    }
    
    const batchesWithDetails = await Promise.all(
      batches.map(async (batch) => {
        const client = await ctx.db.get(batch.clientId as any);
        const assignments = await ctx.db
          .query("assignments")
          .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
          .collect();
        
        const statusCounts = assignments.reduce((acc, a) => {
          acc[a.status] = (acc[a.status] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          ...batch,
          client,
          assignmentCount: assignments.length,
          statusCounts,
        };
      })
    );
    
    return batchesWithDetails;
  },
});

export const get = query({
  args: { id: v.id("batches") },
  handler: async (ctx, args) => {
    const batch = await ctx.db.get(args.id);
    if (!batch) return null;
    
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_batch", (q) => q.eq("batchId", args.id))
      .collect();
    
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const kit = await ctx.db.get(assignment.kitId);
        const program = kit ? await ctx.db.get(kit.programId) : null;
        return {
          ...assignment,
          kit,
          program,
        };
      })
    );
    
    return {
      ...batch,
      assignments: assignmentsWithDetails,
    };
  },
});

export const create = mutation({
  args: {
    clientId: v.string(),
    clientType: v.union(v.literal("b2b"), v.literal("b2c")),
    batchName: v.optional(v.string()),
    notes: v.optional(v.string()),
    dispatchDate: v.optional(v.number()),
    productionMonth: v.optional(v.string()),
    assignments: v.array(
      v.object({
        kitId: v.id("kits"),
        quantity: v.number(),
        grade: v.optional(
          v.union(
            v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
            v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
          )
        ),
        notes: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate batch ID
    const allBatches = await ctx.db.query("batches").collect();
    const batchNumber = allBatches.length + 1;
    const generatedBatchId = `BATCH-${batchNumber.toString().padStart(3, "0")}`;

    // Create batch
    const batchId = await ctx.db.insert("batches", {
      batchId: args.batchName || generatedBatchId,
      clientId: args.clientId,
      clientType: args.clientType,
      createdBy: userId,
      notes: args.notes,
      dispatchDate: args.dispatchDate,
      productionMonth: args.productionMonth,
    });

    // Create all assignments
    for (const assignment of args.assignments) {
      const kit = await ctx.db.get(assignment.kitId);
      if (!kit) throw new Error(`Kit not found: ${assignment.kitId}`);

      await ctx.db.insert("assignments", {
        kitId: assignment.kitId,
        clientId: args.clientId,
        clientType: args.clientType,
        quantity: assignment.quantity,
        grade: assignment.grade,
        notes: assignment.notes,
        dispatchedAt: args.dispatchDate,
        productionMonth: args.productionMonth,
        status: "assigned",
        createdBy: userId,
        batchId,
      });

      // Do NOT update kit stock - inventory is managed separately
    }

    return batchId;
  },
});

export const update = mutation({
  args: {
    id: v.id("batches"),
    batchName: v.optional(v.string()),
    notes: v.optional(v.string()),
    dispatchDate: v.optional(v.number()),
    productionMonth: v.optional(v.string()),
    cascadeToAssignments: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updates: any = {};
    if (args.batchName !== undefined) updates.batchId = args.batchName;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.dispatchDate !== undefined) updates.dispatchDate = args.dispatchDate;
    if (args.productionMonth !== undefined) updates.productionMonth = args.productionMonth;

    await ctx.db.patch(args.id, updates);

    // Cascade to assignments if requested
    if (args.cascadeToAssignments) {
      const assignments = await ctx.db
        .query("assignments")
        .withIndex("by_batch", (q) => q.eq("batchId", args.id))
        .collect();

      for (const assignment of assignments) {
        const assignmentUpdates: any = {};
        if (args.dispatchDate !== undefined) assignmentUpdates.dispatchedAt = args.dispatchDate;
        if (args.productionMonth !== undefined) assignmentUpdates.productionMonth = args.productionMonth;
        
        if (Object.keys(assignmentUpdates).length > 0) {
          await ctx.db.patch(assignment._id, assignmentUpdates);
        }
      }
    }
  },
});

export const updateBatchWithAssignments = mutation({
  args: {
    batchId: v.id("batches"),
    batchName: v.optional(v.string()),
    notes: v.optional(v.string()),
    dispatchDate: v.optional(v.number()),
    productionMonth: v.optional(v.string()),
    assignments: v.array(v.object({
      assignmentId: v.optional(v.id("assignments")),
      kitId: v.id("kits"),
      quantity: v.number(),
      grade: v.optional(v.union(
        v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
        v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
      )),
      notes: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    // Update batch details
    const batchUpdates: any = {};
    if (args.batchName !== undefined) batchUpdates.batchId = args.batchName;
    if (args.notes !== undefined) batchUpdates.notes = args.notes;
    if (args.dispatchDate !== undefined) batchUpdates.dispatchDate = args.dispatchDate;
    if (args.productionMonth !== undefined) batchUpdates.productionMonth = args.productionMonth;

    if (Object.keys(batchUpdates).length > 0) {
      await ctx.db.patch(args.batchId, batchUpdates);
    }

    // Handle assignments (Upsert)
    for (const item of args.assignments) {
      if (item.assignmentId) {
        // Update existing assignment
        const existing = await ctx.db.get(item.assignmentId);
        if (existing && existing.batchId === args.batchId) {
           await ctx.db.patch(item.assignmentId, {
             kitId: item.kitId,
             quantity: item.quantity,
             grade: item.grade,
             notes: item.notes,
             // Sync common fields from batch if they were updated, or keep them?
             // Usually in a batch edit, we want these to align with the batch settings
             // if they are being set.
             // if they are being set.
             dispatchedAt: args.dispatchDate ?? existing.dispatchedAt,
             productionMonth: args.productionMonth ?? existing.productionMonth,
           });
        }
      } else {
        // Create new assignment
        await ctx.db.insert("assignments", {
          batchId: args.batchId,
          kitId: item.kitId,
          clientId: batch.clientId,
          clientType: batch.clientType,
          quantity: item.quantity,
          grade: item.grade,
          notes: item.notes,
          status: "assigned",
          createdBy: userId,
          dispatchedAt: args.dispatchDate ?? batch.dispatchDate,
          productionMonth: args.productionMonth ?? batch.productionMonth,
        });
      }
    }
  },
});

// Deprecated: Use remove (deletion request) instead
// export const deleteBatch = mutation({
//   args: { id: v.id("batches") },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");

//     // Get all assignments in batch
//     const assignments = await ctx.db
//       .query("assignments")
//       .withIndex("by_batch", (q) => q.eq("batchId", args.id))
//       .collect();

//     // Check if any assignment is dispatched
//     const hasDispatched = assignments.some((a) => a.status === "dispatched");
//     if (hasDispatched) {
//       throw new Error("Cannot delete batch with dispatched assignments");
//     }

//     // Delete all assignments (do NOT restore stock - inventory is managed separately)
//     for (const assignment of assignments) {
//       await ctx.db.delete(assignment._id);
//     }

//     // Delete batch
//     await ctx.db.delete(args.id);
//   },
// });

export const addAssignment = mutation({
  args: {
    batchId: v.id("batches"),
    kitId: v.id("kits"),
    quantity: v.number(),
    grade: v.optional(
      v.union(
        v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
        v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    const kit = await ctx.db.get(args.kitId);
    if (!kit) throw new Error("Kit not found");

    const assignmentId = await ctx.db.insert("assignments", {
      kitId: args.kitId,
      clientId: batch.clientId,
      clientType: batch.clientType ?? "b2b",
      quantity: args.quantity,
      grade: args.grade,
      notes: args.notes,
      dispatchedAt: batch.dispatchDate,
      productionMonth: batch.productionMonth,
      status: "assigned",
      createdBy: userId,
      batchId: args.batchId,
    });

    // Do NOT update kit stock - inventory is managed separately

    return assignmentId;
  },
});

export const removeAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");
    if (!assignment.batchId) throw new Error("Assignment is not part of a batch");

    // Do NOT restore stock - inventory is managed separately
    await ctx.db.delete(args.assignmentId);
  },
});

export const remove = mutation({
  args: { id: v.id("batches") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const batch = await ctx.db.get(args.id);
    if (!batch) throw new Error("Batch not found");

    // Check if any assignment is dispatched
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_batch", (q) => q.eq("batchId", args.id))
      .collect();

    const hasDispatched = assignments.some((a) => a.status === "dispatched");
    if (hasDispatched) {
      throw new Error("Cannot delete batch with dispatched assignments");
    }

    await ctx.db.insert("deletionRequests", {
      entityType: "batch",
      entityId: args.id,
      entityName: batch.batchId,
      status: "pending",
      requestedBy: userId,
      reason: "User requested deletion",
    });
  },
});