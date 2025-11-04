import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("assignments").collect();
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
    clientId: v.id("clients"),
    kitId: v.id("kits"),
    quantity: v.number(),
    grade: v.optional(v.union(
      v.literal("1"), v.literal("2"), v.literal("3"), v.literal("4"), v.literal("5"),
      v.literal("6"), v.literal("7"), v.literal("8"), v.literal("9"), v.literal("10")
    )),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("assignments", {
      ...args,
      status: "pending",
      createdBy: userId,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("assignments"),
    status: v.union(
      v.literal("pending"),
      v.literal("fulfilled"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "fulfilled") {
      updates.fulfilledAt = Date.now();
    }

    await ctx.db.patch(args.id, updates);
  },
});

export const getByClient = query({
  args: { clientId: v.id("clients") },
  handler: async (ctx, args) => {
    const assignments = await ctx.db
      .query("assignments")
      .withIndex("by_client", (q) => q.eq("clientId", args.clientId))
      .collect();

    // Fetch kit details for each assignment
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

    await ctx.db.delete(args.id);
  },
});
