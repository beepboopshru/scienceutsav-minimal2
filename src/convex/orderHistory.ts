import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// List all order history records
export const list = query({
  args: {},
  handler: async (ctx) => {
    const orders = await ctx.db.query("orderHistory").order("desc").collect();
    
    // Enrich with kit, client, and batch data
    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
        const kit = await ctx.db.get(order.kitId);
        
        let client = null;
        if (order.clientType === "b2b") {
          client = await ctx.db.get(order.clientId as Id<"clients">);
        } else {
          client = await ctx.db.get(order.clientId as Id<"b2cClients">);
        }
        
        let batch = null;
        if (order.batchId) {
          batch = await ctx.db.get(order.batchId);
        }

        let program = null;
        if (kit?.programId) {
          program = await ctx.db.get(kit.programId);
        }
        
        return {
          ...order,
          kit,
          client,
          batch,
          program,
        };
      })
    );
    
    return enrichedOrders;
  },
});

// Create custom dispatch record directly to order history
export const createCustomDispatch = mutation({
  args: {
    clientId: v.string(),
    clientType: v.union(v.literal("b2b"), v.literal("b2c")),
    customName: v.string(),
    remarks: v.optional(v.string()),
    dispatchNumber: v.optional(v.string()),
    dispatchDocumentId: v.optional(v.id("_storage")),
    ewayNumber: v.optional(v.string()),
    ewayDocumentId: v.optional(v.id("_storage")),
    trackingLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();

    if (!user) throw new Error("User not found");

    // Create a placeholder kit entry for custom dispatch
    const kitId = await ctx.db.insert("kits", {
      name: args.customName,
      programId: "placeholder" as any, // This will be a custom dispatch marker
      stockCount: 0,
      status: "archived",
      notes: "Custom dispatch record - not a real kit",
      createdBy: user._id,
    });

    // Create order history record
    const orderHistoryId = await ctx.db.insert("orderHistory", {
      kitId: kitId,
      clientId: args.clientId,
      clientType: args.clientType,
      quantity: 1,
      dispatchedAt: Date.now(),
      dispatchedBy: user._id,
      status: "dispatched",
      remarks: args.remarks,
      notes: "Custom dispatch created directly",
      originalAssignmentId: "custom_dispatch" as any,
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: user._id,
      actionType: "custom_dispatch_created",
      details: `Custom dispatch created: ${args.customName} for client ${args.clientId}`,
    });

    return orderHistoryId;
  },
});

// Create order history from dispatched assignment
export const createFromAssignment = mutation({
  args: {
    assignmentId: v.id("assignments"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), identity.email))
      .first();

    if (!user) throw new Error("User not found");

    // Get the assignment
    const assignment = await ctx.db.get(args.assignmentId);
    if (!assignment) throw new Error("Assignment not found");

    // Only allow dispatched or delivered assignments
    if (assignment.status !== "dispatched" && assignment.status !== "delivered") {
      throw new Error("Only dispatched or delivered assignments can be moved to order history");
    }

    // Create order history record
    const orderHistoryId = await ctx.db.insert("orderHistory", {
      kitId: assignment.kitId,
      clientId: assignment.clientId,
      clientType: assignment.clientType,
      quantity: assignment.quantity,
      grade: assignment.grade,
      productionMonth: assignment.productionMonth,
      batchId: assignment.batchId,
      dispatchedAt: assignment.dispatchedAt || Date.now(),
      dispatchedBy: user._id,
      status: assignment.status as "dispatched" | "delivered",
      deliveredAt: assignment.deliveredAt,
      notes: assignment.notes,
      originalAssignmentId: args.assignmentId,
    });

    // Delete the assignment
    await ctx.db.delete(args.assignmentId);

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: user._id,
      actionType: "order_archived",
      details: `Assignment ${args.assignmentId} moved to order history`,
    });

    return orderHistoryId;
  },
});

// Update order status
export const updateStatus = mutation({
  args: {
    id: v.id("orderHistory"),
    status: v.union(
      v.literal("dispatched"),
      v.literal("delivered"),
      v.literal("cancelled")
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

    const order = await ctx.db.get(args.id);
    if (!order) throw new Error("Order not found");

    const updates: any = { status: args.status };
    
    if (args.status === "delivered" && !order.deliveredAt) {
      updates.deliveredAt = Date.now();
    }

    await ctx.db.patch(args.id, updates);

    await ctx.db.insert("activityLogs", {
      userId: user._id,
      actionType: "order_status_updated",
      details: `Order ${args.id} status updated to ${args.status}`,
    });

    return args.id;
  },
});

// Add notes to order
export const addNotes = mutation({
  args: {
    id: v.id("orderHistory"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    await ctx.db.patch(args.id, { notes: args.notes });

    return args.id;
  },
});