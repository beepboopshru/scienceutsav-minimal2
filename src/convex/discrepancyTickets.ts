import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    clientId: v.string(),
    clientType: v.union(v.literal("b2b"), v.literal("b2c")),
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
      clientType: args.clientType,
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
        let client = null;
        let clientDisplayName = "Unknown Client";
        
        if (ticket.clientType === "b2b") {
          try {
            const b2bClient = await ctx.db.get(ticket.clientId as any);
            if (b2bClient && "_id" in b2bClient) {
              client = b2bClient;
              clientDisplayName = (b2bClient as any).organization || (b2bClient as any).name || "Unknown Client";
            }
          } catch {
            // Client not found
          }
        } else if (ticket.clientType === "b2c") {
          try {
            const b2cClient = await ctx.db.get(ticket.clientId as any);
            if (b2cClient && "_id" in b2cClient) {
              client = b2cClient;
              clientDisplayName = (b2cClient as any).buyerName || "Unknown Client";
            }
          } catch {
            // Client not found
          }
        }
        
        const creator = await ctx.db.get(ticket.createdBy);
        
        return {
          ...ticket,
          client,
          clientDisplayName,
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

export const remove = mutation({
  args: { id: v.id("discrepancyTickets") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const ticket = await ctx.db.get(args.id);
    if (!ticket) throw new Error("Ticket not found");

    await ctx.db.insert("deletionRequests", {
      entityType: "discrepancyTicket",
      entityId: args.id,
      entityName: `Ticket: ${ticket.discrepancy}`,
      status: "pending",
      requestedBy: userId,
    });
  },
});