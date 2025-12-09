import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { hasPermission } from "./permissions";

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
    clientId: v.string(),
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

    const canCreate = await hasPermission(ctx, userId, "assignments", "create");
    if (!canCreate) throw new Error("Permission denied");

    // Create assignment without deducting kit inventory
    const assignmentId = await ctx.db.insert("assignments", {
      ...args,
      status: "assigned",
      createdBy: userId,
    });

    // Notify operations users about new assignment
    await ctx.scheduler.runAfter(0, internal.assignments.notifyOperationsUsers, {
      assignmentId,
    });

    return assignmentId;
  },
});

export const update = mutation({
  args: {
    id: v.id("assignments"),
    kitId: v.optional(v.id("kits")),
    clientId: v.optional(v.id("clients")),
    b2cClientId: v.optional(v.id("b2cClients")),
    quantity: v.optional(v.number()),
    grade: v.optional(v.union(
      v.literal("1"),
      v.literal("2"),
      v.literal("3"),
      v.literal("4"),
      v.literal("5"),
      v.literal("6"),
      v.literal("7"),
      v.literal("8"),
      v.literal("9"),
      v.literal("10")
    )),
    notes: v.optional(v.string()),
    dispatchedAt: v.optional(v.number()),
    productionMonth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new Error("Assignment not found");

    // Build update object with only provided fields
    const updates: any = {};
    if (args.kitId !== undefined) updates.kitId = args.kitId;
    if (args.clientId !== undefined) updates.clientId = args.clientId;
    if (args.b2cClientId !== undefined) updates.clientId = args.b2cClientId;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.grade !== undefined) updates.grade = args.grade;
    if (args.notes !== undefined) updates.notes = args.notes;
    if (args.dispatchedAt !== undefined) updates.dispatchedAt = args.dispatchedAt;
    if (args.productionMonth !== undefined) updates.productionMonth = args.productionMonth;

    await ctx.db.patch(args.id, updates);

    // Log activity
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await ctx.db.insert("activityLogs", {
        userId: userId,
        actionType: "assignment_updated",
        details: `Updated assignment ${args.id}`,
      });
    }

    return args.id;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("assignments"),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_production"),
      v.literal("ready_to_pack"),
      v.literal("received_from_inventory"),
      v.literal("transferred_to_dispatch"),
      v.literal("ready_for_dispatch"),
      v.literal("dispatched"),
      v.literal("delivered"),
      v.literal("processing")
    ),
    ewayNumber: v.optional(v.string()),
    ewayDocumentId: v.optional(v.id("_storage")),
    dispatchNumber: v.optional(v.string()),
    dispatchDocumentId: v.optional(v.id("_storage")),
    trackingLink: v.optional(v.string()),
    proofPhotoId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.id);
    if (!assignment) {
      throw new Error("Assignment not found");
    }

    const updateData: any = {
      status: args.status,
    };

    // Add dispatch-related fields if provided
    if (args.ewayNumber !== undefined) updateData.ewayNumber = args.ewayNumber;
    if (args.ewayDocumentId !== undefined) updateData.ewayDocumentId = args.ewayDocumentId;
    if (args.dispatchNumber !== undefined) updateData.dispatchNumber = args.dispatchNumber;
    if (args.dispatchDocumentId !== undefined) updateData.dispatchDocumentId = args.dispatchDocumentId;
    if (args.trackingLink !== undefined) updateData.trackingLink = args.trackingLink;
    if (args.proofPhotoId !== undefined) updateData.proofPhotoId = args.proofPhotoId;

    // Set timestamps based on status
    if (args.status === "dispatched" && !assignment.dispatchedAt) {
      updateData.dispatchedAt = Date.now();
    }

    if (args.status === "delivered" && !assignment.deliveredAt) {
      updateData.deliveredAt = Date.now();
    }

    await ctx.db.patch(args.id, updateData);

    // Log the status change
    const userId = await getAuthUserId(ctx);
    if (userId) {
      await ctx.db.insert("activityLogs", {
        userId: userId,
        actionType: "assignment_status_updated",
        details: `Assignment ${args.id} status changed to ${args.status}`,
      });
    }

    // If status is delivered, move to order history and delete assignment
    if (args.status === "delivered") {
      const user = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("_id"), userId))
        .first();

      if (user) {
        // Create order history record
        await ctx.db.insert("orderHistory", {
          kitId: assignment.kitId,
          clientId: assignment.clientId,
          clientType: assignment.clientType,
          quantity: assignment.quantity,
          grade: assignment.grade,
          productionMonth: assignment.productionMonth,
          batchId: assignment.batchId,
          dispatchedAt: assignment.dispatchedAt || Date.now(),
          dispatchedBy: user._id,
          status: "delivered",
          deliveredAt: updateData.deliveredAt || Date.now(),
          notes: assignment.notes,
          originalAssignmentId: args.id,
        });

        // Delete the assignment
        await ctx.db.delete(args.id);

        // Log the archival
        await ctx.db.insert("activityLogs", {
          userId: user._id,
          actionType: "order_archived",
          details: `Assignment ${args.id} moved to order history after delivery`,
        });
      }
    }
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

export const updateRemarks = mutation({
  args: {
    id: v.id("assignments"),
    remarks: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.id, {
      remarks: args.remarks,
    });
  },
});

export const updatePackingNotes = mutation({
  args: {
    id: v.id("assignments"),
    packingNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const canUpdate = await hasPermission(ctx, userId, "packing", "edit");
    if (!canUpdate) throw new Error("Permission denied");

    await ctx.db.patch(args.id, {
      packingNotes: args.packingNotes,
    });
  },
});

export const updateDispatchNotes = mutation({
  args: {
    id: v.id("assignments"),
    dispatchNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const canUpdate = await hasPermission(ctx, userId, "dispatch", "edit");
    if (!canUpdate) throw new Error("Permission denied");

    await ctx.db.patch(args.id, {
      dispatchNotes: args.dispatchNotes,
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

    const kit = await ctx.db.get(assignment.kitId);
    const entityName = kit ? `Assignment for ${kit.name}` : `Assignment ${args.id}`;

    return await ctx.db.insert("deletionRequests", {
      entityType: "assignment",
      entityId: args.id,
      entityName: entityName,
      status: "pending",
      requestedBy: userId,
      reason: "User requested deletion",
    });
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.id);
    if (!assignment) throw new Error("Assignment not found");

    const kit = await ctx.db.get(assignment.kitId);
    const entityName = kit ? `Assignment for ${kit.name}` : `Assignment ${args.id}`;

    return await ctx.db.insert("deletionRequests", {
      entityType: "assignment",
      entityId: args.id,
      entityName: entityName,
      status: "pending",
      requestedBy: userId,
      reason: "User requested deletion",
    });
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
      v.literal("received_from_inventory"),
      v.literal("transferred_to_dispatch"),
      v.literal("processing")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    // Update the main status field - no inventory modifications
    await ctx.db.patch(args.assignmentId, {
      status: args.packingStatus,
    });

    return args.assignmentId;
  },
});

export const notifyOperationsUsers = internalMutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return;

    // Fetch kit and client information
    const kit = await ctx.db.get(assignment.kitId);
    
    // Query client by clientId string from the appropriate table
    let client = null;
    if (assignment.clientType === "b2c") {
      client = await ctx.db
        .query("b2cClients")
        .filter((q) => q.eq(q.field("_id"), assignment.clientId))
        .first();
    } else {
      client = await ctx.db
        .query("clients")
        .filter((q) => q.eq(q.field("_id"), assignment.clientId))
        .first();
    }

    const kitName = kit?.name || "Unknown Kit";
    const clientName = assignment.clientType === "b2c"
      ? (client as any)?.buyerName || "Unknown Client"
      : (client as any)?.name || (client as any)?.organization || "Unknown Client";

    // Get all operations users with notification permission
    const allUsers = await ctx.db.query("users").collect();
    const operationsUsers = allUsers.filter((user) => user.role === "operations");

    // Check each operations user's notification permission
    for (const user of operationsUsers) {
      const permissions = await ctx.db
        .query("userPermissions")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .first();

      const canReceive =
        (permissions?.permissions as any)?.notifications?.receive ?? true;

      if (canReceive) {
        await ctx.db.insert("notifications", {
          userId: user._id,
          type: "new_assignment",
          message: `New assignment: ${kitName} for ${clientName}`,
          relatedId: args.assignmentId,
          read: false,
        });
      }
    }
  },
});

export const clearPending = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const assignments = await ctx.db.query("assignments").collect();
    const pendingAssignments = assignments.filter(
      a => a.status !== "dispatched" && a.status !== "delivered"
    );

    let count = 0;
    for (const assignment of pendingAssignments) {
      await ctx.db.delete(assignment._id);
      count++;
    }

    // Log the action
    await ctx.db.insert("activityLogs", {
      userId: userId,
      actionType: "assignments_cleared",
      details: `Cleared ${count} pending assignments`,
    });

    return count;
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const assignments = await ctx.db.query("assignments").collect();
    let count = 0;
    
    for (const assignment of assignments) {
      await ctx.db.delete(assignment._id);
      count++;
    }

    // Log the action
    await ctx.db.insert("activityLogs", {
      userId: userId,
      actionType: "all_assignments_cleared",
      details: `Cleared all ${count} assignments`,
    });

    return count;
  },
});