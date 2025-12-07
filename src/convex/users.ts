import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

export const listPending = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").filter(q => q.eq(q.field("role"), "pending")).collect();
  },
});

export const listApproved = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").filter(q => q.neq(q.field("role"), "pending")).collect();
  },
});

export const approveUser = mutation({
  args: { id: v.id("users"), role: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.id, { role: args.role as any });
  },
});

export const updateRole = mutation({
  args: { id: v.id("users"), role: v.string() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.id, { role: args.role as any });
  },
});

export const deleteUser = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.id);
  },
});