import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query("materialRequests").collect();
    return Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const reviewer = r.reviewedBy ? await ctx.db.get(r.reviewedBy) : null;
        return {
          ...r,
          requesterName: user?.name || "Unknown",
          requesterEmail: user?.email || "Unknown",
          reviewerName: reviewer?.name,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    items: v.array(
      v.object({
        inventoryId: v.id("inventory"),
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
      })
    ),
    purpose: v.optional(v.string()),
    assignmentId: v.optional(v.id("assignments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    await ctx.db.insert("materialRequests", {
      userId,
      items: args.items,
      status: "pending",
      purpose: args.purpose,
      assignmentId: args.assignmentId,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("materialRequests"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
  },
});

export const fulfillRequest = mutation({
  args: {
    id: v.id("materialRequests"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    const request = await ctx.db.get(args.id);
    if (!request) throw new Error("Material request not found");
    
    if (request.status !== "approved") {
      throw new Error("Only approved requests can be fulfilled");
    }
    
    // Reduce inventory for each item in the request
    // Rule: Only reduce top-level items, ignore nested BOMs
    for (const item of request.items) {
      const inventoryItem = await ctx.db.get(item.inventoryId);
      if (!inventoryItem) {
        throw new Error(`Inventory item ${item.name} not found`);
      }
      
      // Check if sufficient stock is available
      if (inventoryItem.quantity < item.quantity) {
        throw new Error(`Insufficient stock for ${item.name}. Available: ${inventoryItem.quantity}, Required: ${item.quantity}`);
      }
      
      // Reduce inventory - only the top-level item, not its components
      await ctx.db.patch(item.inventoryId, {
        quantity: inventoryItem.quantity - item.quantity,
      });
    }
    
    // Mark request as fulfilled
    await ctx.db.patch(args.id, {
      status: "approved" as any, // Keep as approved but we could add "fulfilled" status
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
    
    // If this request is linked to an assignment, update assignment status
    if (request.assignmentId) {
      const assignment = await ctx.db.get(request.assignmentId);
      if (assignment && assignment.status === "assigned") {
        await ctx.db.patch(request.assignmentId, {
          status: "received_from_inventory",
        });
      }
    }
    
    // Log the fulfillment
    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "material_request_fulfilled",
      details: `Fulfilled material request ${args.id} with ${request.items.length} items`,
    });
  },
});