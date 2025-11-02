import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("inventory").collect();
  },
});

export const get = query({
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    type: v.union(
      v.literal("raw"),
      v.literal("pre_processed"),
      v.literal("finished"),
      v.literal("sealed_packet")
    ),
    quantity: v.number(),
    unit: v.string(),
    minStockLevel: v.optional(v.number()),
    location: v.optional(v.string()),
    notes: v.optional(v.string()),
    vendorId: v.optional(v.id("vendors")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("inventory", args);
  },
});

export const updateQuantity = mutation({
  args: {
    id: v.id("inventory"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.id, { quantity: args.quantity });
  },
});

export const remove = mutation({
  args: { id: v.id("inventory") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});
