import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: { clientType: v.optional(v.union(v.literal("b2b"), v.literal("b2c"))) },
  handler: async (ctx, args) => {
    let assignments;
    if (args.clientType) {
      assignments = await ctx.db
        .query("assignments")
        .withIndex("by_clientType", (q) => q.eq("clientType", args.clientType!))
        .collect();
    } else {
      assignments = await ctx.db.query("assignments").collect();
    }
    
    // Fetch related data for each assignment
    const assignmentsWithDetails = await Promise.all(
      assignments.map(async (assignment) => {
        const kit = await ctx.db.get(assignment.kitId);
        // Fetch from correct client table based on clientType
        const client = assignment.clientType === "b2c"
          ? await ctx.db.get(assignment.clientId as any)
          : await ctx.db.get(assignment.clientId as any);
        const program = kit ? await ctx.db.get(kit.programId) : null;
        
        return {
          ...assignment,
          kit,
          client,
          program,
        };
      })
    );
    
    return assignmentsWithDetails;
  },
});

export const get = query({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    clientId: v.string(), // Can be Id<"clients"> or Id<"b2cClients">
    clientType: v.union(v.literal("b2b"), v.literal("b2c")),
    kitId: v.id("kits"),
    quantity: v.number(),
    grade: v.optional(v.union(
      v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
      v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
    )),
    notes: v.optional(v.string()),
    dispatchedAt: v.optional(v.number()),
    productionMonth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get the kit to update stock
    const kit = await ctx.db.get(args.kitId);
    if (!kit) throw new Error("Kit not found");

    // Create assignment
    const assignmentId = await ctx.db.insert("assignments", {
      ...args,
      status: "assigned",
      createdBy: userId,
    });

    // Update kit stock
    const newStockCount = kit.stockCount - args.quantity;
    let newStatus: "in_stock" | "assigned" | "to_be_made" = "in_stock";
    
    if (newStockCount === 0) {
      newStatus = "assigned";
    } else if (newStockCount < 0) {
      newStatus = "to_be_made";
    }

    await ctx.db.patch(args.kitId, {
      stockCount: newStockCount,
      status: newStatus,
    });

    return assignmentId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("assignments"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_production"),
      v.literal("ready_for_packing"),
      v.literal("packed"),
      v.literal("transferred_to_dispatch"),
      v.literal("dispatched"),
      v.literal("delivered")
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();

    if (!user) throw new Error("User not found");

    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new Error("Assignment not found");

    const updates: any = { status: args.status };

    if (args.status === "dispatched" && !assignment.dispatchedAt) {
      updates.dispatchedAt = Date.now();
    }

    if (args.status === "delivered" && !assignment.deliveredAt) {
      updates.deliveredAt = Date.now();
    }

    await ctx.db.patch(args.id, updates);

    // If status is dispatched or delivered, move to order history
    if (args.status === "dispatched" || args.status === "delivered") {
      // Create order history record
      await ctx.db.insert("orderHistory", {
        kitId: assignment.kitId,
        clientId: assignment.clientId,
        clientType: assignment.clientType,
        quantity: assignment.quantity,
        grade: assignment.grade,
        productionMonth: assignment.productionMonth,
        batchId: assignment.batchId,
        dispatchedAt: updates.dispatchedAt || assignment.dispatchedAt || Date.now(),
        dispatchedBy: user._id,
        status: args.status as "dispatched" | "delivered",
        deliveredAt: updates.deliveredAt || assignment.deliveredAt,
        notes: assignment.notes,
        originalAssignmentId: args.id,
      });

      // Delete the assignment
      await ctx.db.delete(args.id);

      await ctx.db.insert("activityLogs", {
        userId: user._id,
        actionType: "assignment_archived",
        details: `Assignment ${args.id} moved to order history with status ${args.status}`,
      });
    } else {
      await ctx.db.insert("activityLogs", {
        userId: user._id,
        actionType: "assignment_status_updated",
        details: `Assignment ${args.id} status updated to ${args.status}`,
      });
    }

    return args.id;
  },
});

export const updateNotes = mutation({
  args: {
    id: v.id("assignments"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.id, {
      notes: args.notes,
    });
  },
});

export const deleteAssignment = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new Error("Assignment not found");

    // Restore stock if not dispatched
    if (assignment.status !== "dispatched") {
      const kit = await ctx.db.get(assignment.kitId);
      if (kit) {
        const newStockCount = kit.stockCount + assignment.quantity;
        let newStatus: "in_stock" | "assigned" | "to_be_made" = "in_stock";
        
        if (newStockCount === 0) {
          newStatus = "assigned";
        } else if (newStockCount < 0) {
          newStatus = "to_be_made";
        }

        await ctx.db.patch(assignment.kitId, {
          stockCount: newStockCount,
          status: newStatus,
        });
      }
    }

    await ctx.db.delete(args.id);
  },
});

export const getByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    const assignmentsWithKits = await Promise.all(
      assignments.map(async (assignment) => {
        const kit = await ctx.db.get(assignment.kitId);
        return { ...assignment, kit };
      })
    );

    return assignmentsWithKits;
  },
});

export const remove = mutation({
  args: { id: v.id("assignments") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .unique();

    if (!user) throw new Error("User not found");

    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new Error("Assignment not found");

    if (user.role !== "admin") {
      await ctx.db.insert("deletionRequests", {
        entityType: "assignment",
        entityId: args.id,
        entityName: `Assignment for ${assignment.schoolName || "Unknown School"}`, // Assuming schoolName exists or similar
        status: "pending",
        requestedBy: user._id,
        reason: "User requested deletion",
      });
      return { requestCreated: true, message: "Deletion request submitted for approval" };
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.query("assignments").collect();
  },
});

export const updatePackingStatus = mutation({
  args: {
    assignmentId: v.id("assignments"),
    packingStatus: v.union(
      v.literal("assigned"),
      v.literal("in_progress"),
      v.literal("transferred_to_dispatch")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Update the main status field instead of packingStatus
    await ctx.db.patch(args.assignmentId, {
      status: args.packingStatus,
    });

    return args.assignmentId;
  },
});