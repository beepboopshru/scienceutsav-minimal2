import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    clientId: v.id("clients"),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
    discrepancy: v.string(),
    dueDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can create discrepancy tickets");
    }

    const ticketId = await ctx.db.insert("discrepancyTickets", {
      clientId: args.clientId,
      priority: args.priority,
      discrepancy: args.discrepancy,
      status: "open",
      dueDate: args.dueDate,
      createdBy: userId,
    });

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "discrepancy_ticket_created",
      details: `Created discrepancy ticket for client`,
      performedBy: userId,
    });

    return ticketId;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const tickets = await ctx.db.query("discrepancyTickets").order("desc").collect();
    
    const ticketsWithDetails = await Promise.all(
      tickets.map(async (ticket) => {
        const client = await ctx.db.get(ticket.clientId);
        const creator = await ctx.db.get(ticket.createdBy);
        
        return {
          ...ticket,
          client,
          creator,
        };
      })
    );

    return ticketsWithDetails;
  },
});

export const updateStatus = mutation({
  args: {
    ticketId: v.id("discrepancyTickets"),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("closed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || !["admin", "operations", "manager"].includes(user.role || "")) {
      throw new Error("Not authorized to update ticket status");
    }

    // Only admin and operations can mark as resolved
    if (args.status === "resolved" && !["admin", "operations"].includes(user.role || "")) {
      throw new Error("Only admins and operations members can mark tickets as resolved");
    }

    await ctx.db.patch(args.ticketId, {
      status: args.status,
    });

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "discrepancy_ticket_updated",
      details: `Updated ticket status to ${args.status}`,
      performedBy: userId,
    });
  },
});

export const deleteTicket = mutation({
  args: {
    ticketId: v.id("discrepancyTickets"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") {
      throw new Error("Only admins can delete tickets");
    }

    await ctx.db.delete(args.ticketId);

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "discrepancy_ticket_deleted",
      details: `Deleted discrepancy ticket`,
      performedBy: userId,
    });
  },
});
