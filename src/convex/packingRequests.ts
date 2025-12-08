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

    // Categorized materials structure
    const mainPouchMaterials = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string; category: string }>();
    const sealedPackets = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string; category: string }>();
    const bulkMaterials = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string; category: string }>();
    const spareMaterials = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string; category: string }>();
    const miscMaterials = new Map<string, { inventoryId: string; name: string; type: string; quantity: number; unit: string; category: string }>();

    for (const assignmentId of args.assignmentIds) {
      const assignment = await ctx.db.get(assignmentId);
      if (!assignment) continue;

      const kit = await ctx.db.get(assignment.kitId);
      if (!kit) continue;

      // Process structured packing requirements
      if (kit.isStructured && kit.packingRequirements) {
        try {
          const structure = JSON.parse(kit.packingRequirements);
          
          // Process main pouch materials
          if (structure.pouches && Array.isArray(structure.pouches)) {
            for (const pouch of structure.pouches) {
              if (pouch.materials && Array.isArray(pouch.materials)) {
                for (const material of pouch.materials) {
                  if (!material.inventoryItemId) continue;
                  
                  const requiredQty = (material.quantity || 0) * assignment.quantity;
                  const key = material.inventoryItemId;
                  
                  if (mainPouchMaterials.has(key)) {
                    mainPouchMaterials.get(key)!.quantity += requiredQty;
                  } else {
                    mainPouchMaterials.set(key, {
                      inventoryId: material.inventoryItemId,
                      name: material.name || "Unknown",
                      type: material.type || "raw",
                      quantity: requiredQty,
                      unit: material.unit || "pcs",
                      category: "main_pouch",
                    });
                  }
                }
              }
            }
          }

          // Process sealed packets
          if (structure.packets && Array.isArray(structure.packets)) {
            for (const packet of structure.packets) {
              // Check for both inventoryItemId and name
              const packetName = packet.name;
              if (!packetName) continue;
              
              // Find the sealed packet in inventory by name
              const sealedPacketItem = await ctx.db
                .query("inventory")
                .withIndex("by_name", (q: any) => q.eq("name", packetName))
                .first();
              
              if (!sealedPacketItem) {
                console.log(`Sealed packet not found in inventory: ${packetName}`);
                continue;
              }
              
              const requiredQty = (packet.quantity || 0) * assignment.quantity;
              const key = sealedPacketItem._id;
              
              if (sealedPackets.has(key)) {
                sealedPackets.get(key)!.quantity += requiredQty;
              } else {
                sealedPackets.set(key, {
                  inventoryId: sealedPacketItem._id,
                  name: sealedPacketItem.name,
                  type: "sealed_packet",
                  quantity: requiredQty,
                  unit: packet.unit || sealedPacketItem.unit || "pcs",
                  category: "sealed_packet",
                });
              }
            }
          }
        } catch (e) {
          console.error('Error parsing packingRequirements:', e);
        }
      }

      // Process kit components (if not structured or as fallback)
      if (kit.components && Array.isArray(kit.components)) {
        for (const comp of kit.components) {
          const invItem = await ctx.db.get(comp.inventoryItemId);
          if (!invItem) continue;

          const requiredQty = comp.quantityPerKit * assignment.quantity;
          const key = invItem._id;

          if (mainPouchMaterials.has(key)) {
            mainPouchMaterials.get(key)!.quantity += requiredQty;
          } else {
            mainPouchMaterials.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
              category: "main_pouch",
            });
          }
        }
      }

      // Process spare kits
      if (kit.spareKits && Array.isArray(kit.spareKits)) {
        for (const item of kit.spareKits) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), item.name))
            .first();
          
          if (!invItem) continue;

          const requiredQty = item.quantity * assignment.quantity;
          const key = invItem._id;

          if (spareMaterials.has(key)) {
            spareMaterials.get(key)!.quantity += requiredQty;
          } else {
            spareMaterials.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
              category: "spare",
            });
          }
        }
      }

      // Process bulk materials
      if (kit.bulkMaterials && Array.isArray(kit.bulkMaterials)) {
        for (const item of kit.bulkMaterials) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), item.name))
            .first();
          
          if (!invItem) continue;

          const requiredQty = item.quantity * assignment.quantity;
          const key = invItem._id;

          if (bulkMaterials.has(key)) {
            bulkMaterials.get(key)!.quantity += requiredQty;
          } else {
            bulkMaterials.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
              category: "bulk",
            });
          }
        }
      }

      // Process miscellaneous
      if (kit.miscellaneous && Array.isArray(kit.miscellaneous)) {
        for (const item of kit.miscellaneous) {
          const invItem = await ctx.db
            .query("inventory")
            .filter((q) => q.eq(q.field("name"), item.name))
            .first();
          
          if (!invItem) continue;

          const requiredQty = item.quantity * assignment.quantity;
          const key = invItem._id;

          if (miscMaterials.has(key)) {
            miscMaterials.get(key)!.quantity += requiredQty;
          } else {
            miscMaterials.set(key, {
              inventoryId: invItem._id,
              name: invItem.name,
              type: invItem.type,
              quantity: requiredQty,
              unit: invItem.unit,
              category: "misc",
            });
          }
        }
      }
    }

    // Combine all materials with category information
    const items = [
      ...Array.from(mainPouchMaterials.values()),
      ...Array.from(sealedPackets.values()),
      ...Array.from(bulkMaterials.values()),
      ...Array.from(spareMaterials.values()),
      ...Array.from(miscMaterials.values()),
    ].map(item => ({
      inventoryId: item.inventoryId as any,
      name: item.name,
      type: item.type,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
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

    // Reduce inventory based on category
    for (const item of request.items) {
      const inventoryItem = await ctx.db.get(item.inventoryId as any);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.name} not found`);
      }

      const invItem = inventoryItem as any;
      
      if (invItem.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${invItem.quantity}, Required: ${item.quantity}`);
      }

      // Reduce stock directly for all categories
      // Main pouch materials, sealed packets, bulk, spare, and misc are all reduced directly
      await ctx.db.patch(item.inventoryId as any, {
        quantity: invItem.quantity - item.quantity,
      });
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