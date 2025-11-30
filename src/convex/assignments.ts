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
      v.literal("ready_for_dispatch"),
      v.literal("dispatched"),
      v.literal("delivered")
    ),
    ewayNumber: v.optional(v.string()),
    ewayDocumentId: v.optional(v.id("_storage")),
    dispatchNumber: v.optional(v.string()),
    dispatchDocumentId: v.optional(v.id("_storage")),
    trackingLink: v.optional(v.string()),
    proofPhotoId: v.optional(v.id("_storage")),
    remarks: v.optional(v.string()),
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

    const previousStatus = assignment.status;

    await ctx.db.insert("deletionRequests", {
      entityType: "assignment",
      entityId: args.id,
      entityName: `Assignment ${assignment._id}`,
      status: "pending",
      requestedBy: user._id,
    });

    const updates: any = { status: args.status };

    // When ready_for_dispatch, reduce the finished kit inventory
    if (args.status === "ready_for_dispatch" && previousStatus !== "ready_for_dispatch") {
      const kit = await ctx.db.get(assignment.kitId);
      if (kit) {
        const inventoryItem = await ctx.db
          .query("inventory")
          .filter((q) => 
            q.and(
              q.eq(q.field("name"), kit.name),
              q.eq(q.field("type"), "finished")
            )
          )
          .first();

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity - assignment.quantity;
          await ctx.db.patch(inventoryItem._id, {
            quantity: Math.max(0, newQuantity),
          });
        }
      }
    }

    // Set dispatchedAt timestamp when dispatched
    if (args.status === "dispatched" && previousStatus !== "dispatched") {
      updates.dispatchedAt = Date.now();
    }

    if (args.status === "delivered" && !assignment.deliveredAt) {
      updates.deliveredAt = Date.now();
    }

    if (args.ewayNumber) {
      updates.ewayNumber = args.ewayNumber;
    }

    if (args.ewayDocumentId) {
      updates.ewayDocumentId = args.ewayDocumentId;
    }

    if (args.dispatchNumber) {
      updates.dispatchNumber = args.dispatchNumber;
    }

    if (args.dispatchDocumentId) {
      updates.dispatchDocumentId = args.dispatchDocumentId;
    }

      if (args.trackingLink) {
        updates.trackingLink = args.trackingLink;
      }
      if (args.proofPhotoId) {
        updates.proofPhotoId = args.proofPhotoId;
      }
      if (args.remarks) {
        updates.remarks = args.remarks;
      }

    await ctx.db.patch(args.id, updates);

    // Only move to order history when status is delivered
    if (args.status === "delivered") {
      // Create order history record
      const orderHistoryData: any = {
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
      };

      if (updates.ewayNumber || (assignment as any).ewayNumber) {
        orderHistoryData.ewayNumber = updates.ewayNumber || (assignment as any).ewayNumber;
      }

      if (updates.ewayDocumentId || (assignment as any).ewayDocumentId) {
        orderHistoryData.ewayDocumentId = updates.ewayDocumentId || (assignment as any).ewayDocumentId;
      }

      if (updates.dispatchNumber || (assignment as any).dispatchNumber) {
        orderHistoryData.dispatchNumber = updates.dispatchNumber || (assignment as any).dispatchNumber;
      }

      if (updates.dispatchDocumentId || (assignment as any).dispatchDocumentId) {
        orderHistoryData.dispatchDocumentId = updates.dispatchDocumentId || (assignment as any).dispatchDocumentId;
      }

      if (updates.trackingLink || (assignment as any).trackingLink) {
        orderHistoryData.trackingLink = updates.trackingLink || (assignment as any).trackingLink;
      }

      if (updates.proofPhotoId || (assignment as any).proofPhotoId) {
        orderHistoryData.proofPhotoId = updates.proofPhotoId || (assignment as any).proofPhotoId;
      }

      if (updates.remarks || assignment.remarks) {
        orderHistoryData.remarks = updates.remarks || assignment.remarks;
      }

      await ctx.db.insert("orderHistory", orderHistoryData);

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
      v.literal("transferred_to_dispatch")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    const previousStatus = assignment.status || "assigned";

    // Update the main status field instead of packingStatus
    await ctx.db.patch(args.assignmentId, {
      status: args.packingStatus,
    });

    // If status changed to transferred_to_dispatch, increase kit inventory
    if (args.packingStatus === "transferred_to_dispatch" && previousStatus !== "transferred_to_dispatch") {
      const kit = await ctx.db.get(assignment.kitId);
      if (kit) {
        // Find or create inventory item for this finished kit
        const inventoryItem = await ctx.db
          .query("inventory")
          .filter((q) => 
            q.and(
              q.eq(q.field("name"), kit.name),
              q.eq(q.field("type"), "finished")
            )
          )
          .first();

        if (inventoryItem) {
          // Update existing inventory
          await ctx.db.patch(inventoryItem._id, {
            quantity: inventoryItem.quantity + assignment.quantity,
          });
        } else {
          // Create new inventory item for finished kit
          await ctx.db.insert("inventory", {
            name: kit.name,
            description: `Finished kit: ${kit.name}`,
            type: "finished",
            quantity: assignment.quantity,
            unit: "pcs",
            minStockLevel: 0,
          });
        }
      }
    }

    // If status changed from transferred_to_dispatch back to another status, decrease kit inventory
    if (previousStatus === "transferred_to_dispatch" && args.packingStatus !== "transferred_to_dispatch") {
      const kit = await ctx.db.get(assignment.kitId);
      if (kit) {
        const inventoryItem = await ctx.db
          .query("inventory")
          .filter((q) => 
            q.and(
              q.eq(q.field("name"), kit.name),
              q.eq(q.field("type"), "finished")
            )
          )
          .first();

        if (inventoryItem) {
          const newQuantity = inventoryItem.quantity - assignment.quantity;
          await ctx.db.patch(inventoryItem._id, {
            quantity: Math.max(0, newQuantity),
          });
        }
      }
    }

    return args.assignmentId;
  },
});