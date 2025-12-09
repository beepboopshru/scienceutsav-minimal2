import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hasPermission } from "./permissions";

// Create a deletion request
export const create = mutation({
  args: {
    entityType: v.string(),
    entityId: v.string(),
    entityName: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const canCreate = await hasPermission(ctx, userId, "deletionRequests", "create");
    if (!canCreate) throw new Error("Not authorized to create deletion requests");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const requestId = await ctx.db.insert("deletionRequests", {
      entityType: args.entityType,
      entityId: args.entityId,
      entityName: args.entityName,
      reason: args.reason,
      status: "pending",
      requestedBy: user._id,
    });

    return requestId;
  },
});

// List all deletion requests
export const list = query({
  args: {
    status: v.optional(v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const canView = await hasPermission(ctx, userId, "deletionRequests", "view");
    if (!canView) throw new Error("Not authorized to view deletion requests");

    let requests;

    if (args.status) {
      requests = await ctx.db
        .query("deletionRequests")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      requests = await ctx.db.query("deletionRequests").collect();
    }

    // Fetch user details for each request
    const requestsWithUsers = await Promise.all(
      requests.map(async (request) => {
        const requestedByUser = await ctx.db.get(request.requestedBy);
        const reviewedByUser = request.reviewedBy ? await ctx.db.get(request.reviewedBy) : null;

        return {
          ...request,
          requestedByUser,
          reviewedByUser,
        };
      })
    );

    return requestsWithUsers;
  },
});

// Approve a deletion request
export const approve = mutation({
  args: {
    requestId: v.id("deletionRequests"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const canApprove = await hasPermission(ctx, userId, "deletionRequests", "approve");
    if (!canApprove) {
      throw new Error("Not authorized to approve deletion requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    if (request.status !== "pending") {
      throw new Error("Request has already been processed");
    }

    // Update the request status
    await ctx.db.patch(args.requestId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });

    // Perform the actual deletion based on entity type
    await performDeletion(ctx, request.entityType, request.entityId);

    return { success: true };
  },
});

// Reject a deletion request
export const reject = mutation({
  args: {
    requestId: v.id("deletionRequests"),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    const canReject = await hasPermission(ctx, userId, "deletionRequests", "reject");
    if (!canReject) {
      throw new Error("Not authorized to reject deletion requests");
    }

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Request not found");

    if (request.status !== "pending") {
      throw new Error("Request has already been processed");
    }

    await ctx.db.patch(args.requestId, {
      status: "rejected",
      reviewedBy: user._id,
      reviewedAt: Date.now(),
      rejectionReason: args.rejectionReason,
    });

    return { success: true };
  },
});

// Helper function to perform actual deletion
async function performDeletion(ctx: MutationCtx, entityType: string, entityId: string) {
  switch (entityType) {
    case "inventory":
      const inventoryItem = await ctx.db.get(entityId as Id<"inventory">);
      if (inventoryItem) {
        await ctx.db.delete(entityId as Id<"inventory">);
      }
      break;
    case "client":
      const client = await ctx.db.get(entityId as Id<"clients">);
      if (client) {
        await ctx.db.delete(entityId as Id<"clients">);
      }
      break;
    case "b2cClient":
      const b2cClient = await ctx.db.get(entityId as Id<"b2cClients">);
      if (b2cClient) {
        await ctx.db.delete(entityId as Id<"b2cClients">);
      }
      break;
    case "kit":
      const kit = await ctx.db.get(entityId as Id<"kits">);
      if (kit) {
        await ctx.db.delete(entityId as Id<"kits">);
      }
      break;
    case "vendor":
      const vendor = await ctx.db.get(entityId as Id<"vendors">);
      if (vendor) {
        await ctx.db.delete(entityId as Id<"vendors">);
      }
      break;
    case "service":
      const service = await ctx.db.get(entityId as Id<"services">);
      if (service) {
        await ctx.db.delete(entityId as Id<"services">);
      }
      break;
    case "assignment":
      const assignment = await ctx.db.get(entityId as Id<"assignments">);
      if (assignment) {
        // Only restore inventory if the assignment was transferred to dispatch
        // (where component stock was reduced and finished kit stock was increased)
        if (assignment.status === "transferred_to_dispatch" || 
            assignment.status === "ready_for_dispatch" || 
            assignment.status === "dispatched") {
          const kit = await ctx.db.get(assignment.kitId);
          if (kit) {
            // Decrease finished kit inventory
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

                if (packingData.packets && Array.isArray(packingData.packets)) {
                  packingData.packets.forEach((packet: any) => {
                    if (packet.materials && Array.isArray(packet.materials)) {
                      packet.materials.forEach((material: any) => {
                        componentsToRestore.push({
                          name: material.name,
                          quantity: material.quantity * assignment.quantity,
                          unit: material.unit,
                        });
                      });
                    }
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
      }
      await ctx.db.delete(entityId as Id<"assignments">);
      break;
    case "processingJob":
      const job = await ctx.db.get(entityId as Id<"processingJobs">);
      if (job && job.status === "in_progress") {
        for (const source of job.sources) {
          const sourceItem = await ctx.db.get(source.sourceItemId);
          if (sourceItem) {
            await ctx.db.patch(source.sourceItemId, {
              quantity: sourceItem.quantity + source.sourceQuantity,
            });
          }
        }
      }
      if (job) {
        await ctx.db.delete(entityId as Id<"processingJobs">);
      }
      break;
    case "program":
      const program = await ctx.db.get(entityId as Id<"programs">);
      if (program) {
        await ctx.db.delete(entityId as Id<"programs">);
      }
      break;
    case "batch":
      const batch = await ctx.db.get(entityId as Id<"batches">);
      if (batch) {
        // Get all assignments in the batch
        const assignments = await ctx.db
          .query("assignments")
          .withIndex("by_batch", (q) => q.eq("batchId", entityId as Id<"batches">))
          .collect();

        // Delete all assignments in the batch
        for (const assignment of assignments) {
          await ctx.db.delete(assignment._id);
        }

        // Delete the batch itself
        await ctx.db.delete(entityId as Id<"batches">);
      }
      break;
    case "billTracking":
      const billTracking = await ctx.db.get(entityId as Id<"billTracking">);
      if (billTracking) {
        await ctx.db.delete(entityId as Id<"billTracking">);
      }
      break;
    case "vendorImport":
      const vendorImport = await ctx.db.get(entityId as Id<"vendorImports">);
      if (vendorImport) {
        await ctx.db.delete(entityId as Id<"vendorImports">);
      }
      break;
    case "laserFile":
      const laserFile = await ctx.db.get(entityId as Id<"laserFiles">);
      if (laserFile) {
        await ctx.db.delete(entityId as Id<"laserFiles">);
      }
      break;
    case "discrepancyTicket":
      const discrepancyTicket = await ctx.db.get(entityId as Id<"discrepancyTickets">);
      if (discrepancyTicket) {
        await ctx.db.delete(entityId as Id<"discrepancyTickets">);
      }
      break;
    case "inventoryCategory":
      const inventoryCategory = await ctx.db.get(entityId as Id<"inventoryCategories">);
      if (inventoryCategory) {
        await ctx.db.delete(entityId as Id<"inventoryCategories">);
      }
      break;
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// Delete a deletion request (for cleanup)
export const remove = mutation({
  args: {
    requestId: v.id("deletionRequests"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can delete requests");
    }

    await ctx.db.delete(args.requestId);
    return { success: true };
  },
});