import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query("packingRequests").collect();
    return Promise.all(
      requests.map(async (r) => {
        const requester = await ctx.db.get(r.requestedBy);
        const fulfiller = r.fulfilledBy ? await ctx.db.get(r.fulfilledBy) : null;
        
        // Fetch assignment details
        const assignments = await Promise.all(
          r.assignmentIds.map(async (id) => {
            const assignment = await ctx.db.get(id);
            if (!assignment) return null;
            const kit = await ctx.db.get(assignment.kitId);
            return {
              _id: assignment._id,
              kitName: kit?.name || "Unknown",
              quantity: assignment.quantity,
            };
          })
        );
        
        return {
          ...r,
          requesterEmail: requester?.email || "Unknown",
          fulfillerEmail: fulfiller?.email || undefined,
          assignments: assignments.filter(a => a !== null),
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    assignmentIds: v.array(v.id("assignments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Aggregate materials from all selected assignments
    const materialMap = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string }>();

    for (const assignmentId of args.assignmentIds) {
      const assignment = await ctx.db.get(assignmentId);
      if (!assignment) continue;

      const kit = await ctx.db.get(assignment.kitId);
      if (!kit) continue;

      // Process structured packing requirements
      if (kit.isStructured && kit.packingRequirements) {
        try {
          const structure = JSON.parse(kit.packingRequirements);
          
          const processMaterial = (material: any) => {
            if (!material.inventoryItemId) return;
            
            const requiredQty = (material.quantity || 0) * assignment.quantity;
            const key = material.inventoryItemId;
            
            if (materialMap.has(key)) {
              materialMap.get(key)!.quantity += requiredQty;
            } else {
              materialMap.set(key, {
                inventoryId: material.inventoryItemId,
                name: material.name || "Unknown",
                type: material.type || "raw",
                quantity: requiredQty,
                unit: material.unit || "pcs",
              });
            }
          };
          
          // Process pouches
          if (structure.pouches && Array.isArray(structure.pouches)) {
            structure.pouches.forEach((pouch: any) => {
              if (pouch.materials && Array.isArray(pouch.materials)) {
                pouch.materials.forEach(processMaterial);
              }
            });
          }

          // Process packets
          if (structure.packets && Array.isArray(structure.packets)) {
            structure.packets.forEach((packet: any) => {
              if (packet.materials && Array.isArray(packet.materials)) {
                packet.materials.forEach(processMaterial);
              }
            });
          }
        } catch (e) {
          console.error('Error parsing packingRequirements:', e);
        }
      }

      // Process kit components
      if (kit.components && Array.isArray(kit.components)) {
        for (const comp of kit.components) {
          const invItem = await ctx.db.get(comp.inventoryItemId);
          if (!invItem) continue;

          const requiredQty = comp.quantityPerKit * assignment.quantity;
          const key = invItem._id;

          if (materialMap.has(key)) {
            materialMap.get(key)!.quantity += requiredQty;
          } else {
            materialMap.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
            });
          }
        }
      }

      // Process spare kits, bulk materials, and miscellaneous
      const processNamedItems = async (items: any[] | undefined) => {
        if (!items) return;
        for (const item of items) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), item.name))
            .first();
          
          if (!invItem) continue;

          const requiredQty = item.quantity * assignment.quantity;
          const key = invItem._id;

          if (materialMap.has(key)) {
            materialMap.get(key)!.quantity += requiredQty;
          } else {
            materialMap.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
            });
          }
        }
      };

      await processNamedItems(kit.spareKits);
      await processNamedItems(kit.bulkMaterials);
      await processNamedItems(kit.miscellaneous);
    }

    const items = Array.from(materialMap.values()).map(item => ({
      inventoryId: item.inventoryId as any,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
    }));

    const requestId = await ctx.db.insert("packingRequests", {
      assignmentIds: args.assignmentIds,
      items,
      status: "pending",
      requestedBy: userId,
    });

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "packing_request_created",
      details: `Created packing request for ${args.assignmentIds.length} assignment(s)`,
    });

    return requestId;
  },
});

export const fulfill = mutation({
  args: {
    id: v.id("packingRequests"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Packing request not found");

    if (request.status !== "pending") {
      throw new Error("Only pending requests can be fulfilled");
    }

    // Reduce inventory for each item (top-level only, no BOM explosion)
    for (const item of request.items) {
      const inventoryItem = await ctx.db.get(item.inventoryId as any);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.name} not found`);
      }

      // Type guard to ensure we have an inventory item
      if (inventoryItem._id.toString().startsWith("inventory|")) {
        const invItem = inventoryItem as any;
        
        if (invItem.quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${item.name}. Available: ${invItem.quantity}, Required: ${item.quantity}`);
        }

        // Reduce only the top-level item
        await ctx.db.patch(item.inventoryId as any, {
          quantity: invItem.quantity - item.quantity,
        });
      }
    }

    // Mark request as fulfilled
    await ctx.db.patch(args.id, {
      status: "done",
      fulfilledBy: userId,
      fulfilledAt: Date.now(),
    });

    // Update all linked assignments to "received_from_inventory"
    for (const assignmentId of request.assignmentIds) {
      const assignment = await ctx.db.get(assignmentId);
      if (assignment && assignment.status === "assigned") {
        await ctx.db.patch(assignmentId, {
          status: "received_from_inventory",
        });
      }
    }

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "packing_request_fulfilled",
      details: `Fulfilled packing request ${args.id} with ${request.items.length} items`,
    });
  },
});
