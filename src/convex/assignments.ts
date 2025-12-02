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

export const updateStatus = mutation({
  args: {
    id: v.id("assignments"),
    status: v.union(
      v.literal("assigned"),
      v.literal("in_production"),
      v.literal("ready_to_pack"),
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

    // If status changed to transferred_to_dispatch, increase kit inventory AND reduce component stock
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

        // Reduce component stock from inventory
        const componentsToReduce: Array<{ name: string; quantity: number; unit: string }> = [];

        // Process structured packing requirements
        if (kit.isStructured && kit.packingRequirements) {
          try {
            const packingData = JSON.parse(kit.packingRequirements);
            
            // Process pouches - reduce individual materials
            if (packingData.pouches && Array.isArray(packingData.pouches)) {
              packingData.pouches.forEach((pouch: any) => {
                if (pouch.materials && Array.isArray(pouch.materials)) {
                  pouch.materials.forEach((material: any) => {
                    componentsToReduce.push({
                      name: material.name,
                      quantity: material.quantity * assignment.quantity,
                      unit: material.unit,
                    });
                  });
                }
              });
            }

            // Process packets - reduce sealed packet quantity, not materials inside
            if (packingData.packets && Array.isArray(packingData.packets)) {
              packingData.packets.forEach((packet: any) => {
                componentsToReduce.push({
                  name: packet.name,
                  quantity: assignment.quantity, // 1 sealed packet per kit
                  unit: "pcs",
                });
              });
            }
          } catch (error) {
            console.error("Error parsing packing requirements:", error);
          }
        }

        // Process spare kits
        if (kit.spareKits && Array.isArray(kit.spareKits)) {
          kit.spareKits.forEach((spare: any) => {
            componentsToReduce.push({
              name: spare.name,
              quantity: spare.quantity * assignment.quantity,
              unit: spare.unit,
            });
          });
        }

        // Process bulk materials
        if (kit.bulkMaterials && Array.isArray(kit.bulkMaterials)) {
          kit.bulkMaterials.forEach((bulk: any) => {
            componentsToReduce.push({
              name: bulk.name,
              quantity: bulk.quantity * assignment.quantity,
              unit: bulk.unit,
            });
          });
        }

        // Process miscellaneous
        if (kit.miscellaneous && Array.isArray(kit.miscellaneous)) {
          kit.miscellaneous.forEach((misc: any) => {
            componentsToReduce.push({
              name: misc.name,
              quantity: misc.quantity * assignment.quantity,
              unit: misc.unit,
            });
          });
        }

        // Aggregate components by name
        const componentMap = new Map<string, { quantity: number; unit: string }>();
        componentsToReduce.forEach((comp) => {
          const key = comp.name.toLowerCase();
          if (componentMap.has(key)) {
            const existing = componentMap.get(key)!;
            existing.quantity += comp.quantity;
          } else {
            componentMap.set(key, { quantity: comp.quantity, unit: comp.unit });
          }
        });

        // Reduce inventory for each component
        for (const [name, data] of componentMap.entries()) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), name))
            .first();

          if (invItem) {
            const newQuantity = invItem.quantity - data.quantity;
            await ctx.db.patch(invItem._id, {
              quantity: Math.max(0, newQuantity),
            });
          }
        }
      }
    }

    // If status changed from transferred_to_dispatch back to another status, decrease kit inventory AND restore component stock
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

        // Restore component stock
        const componentsToRestore: Array<{ name: string; quantity: number; unit: string }> = [];

        // Process structured packing requirements
        if (kit.isStructured && kit.packingRequirements) {
          try {
            const packingData = JSON.parse(kit.packingRequirements);
            
            // Restore pouches - restore individual materials
            if (packingData.pouches && Array.isArray(packingData.pouches)) {
              packingData.pouches.forEach((pouch: any) => {
                if (pouch.materials && Array.isArray(pouch.materials)) {
                  pouch.materials.forEach((material: any) => {
                    componentsToRestore.push({
                      name: material.name,
                      quantity: material.quantity * assignment.quantity,
                      unit: material.unit,
                    });
                  });
                }
              });
            }

            // Restore packets - restore sealed packet quantity
            if (packingData.packets && Array.isArray(packingData.packets)) {
              packingData.packets.forEach((packet: any) => {
                componentsToRestore.push({
                  name: packet.name,
                  quantity: assignment.quantity,
                  unit: "pcs",
                });
              });
            }
          } catch (error) {
            console.error("Error parsing packing requirements:", error);
          }
        }

        if (kit.spareKits && Array.isArray(kit.spareKits)) {
          kit.spareKits.forEach((spare: any) => {
            componentsToRestore.push({
              name: spare.name,
              quantity: spare.quantity * assignment.quantity,
              unit: spare.unit,
            });
          });
        }

        if (kit.bulkMaterials && Array.isArray(kit.bulkMaterials)) {
          kit.bulkMaterials.forEach((bulk: any) => {
            componentsToRestore.push({
              name: bulk.name,
              quantity: bulk.quantity * assignment.quantity,
              unit: bulk.unit,
            });
          });
        }

        if (kit.miscellaneous && Array.isArray(kit.miscellaneous)) {
          kit.miscellaneous.forEach((misc: any) => {
            componentsToRestore.push({
              name: misc.name,
              quantity: misc.quantity * assignment.quantity,
              unit: misc.unit,
            });
          });
        }

        // Aggregate components by name
        const componentMap = new Map<string, { quantity: number; unit: string }>();
        componentsToRestore.forEach((comp) => {
          const key = comp.name.toLowerCase();
          if (componentMap.has(key)) {
            const existing = componentMap.get(key)!;
            existing.quantity += comp.quantity;
          } else {
            componentMap.set(key, { quantity: comp.quantity, unit: comp.unit });
          }
        });

        // Restore inventory for each component
        for (const [name, data] of componentMap.entries()) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), name))
            .first();

          if (invItem) {
            await ctx.db.patch(invItem._id, {
              quantity: invItem.quantity + data.quantity,
            });
          }
        }
      }
    }

    return args.assignmentId;
  },
});

export const notifyOperationsUsers = internalMutation({
  args: { assignmentId: v.id("assignments") },
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) return;

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
          message: `New assignment created`,
          relatedId: args.assignmentId,
          read: false,
        });
      }
    }
  },
});