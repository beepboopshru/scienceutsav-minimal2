import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clients").collect();
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    email: v.optional(v.string()),
    contact: v.optional(v.string()),
    organization: v.optional(v.string()),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }))),
    gradeAttendance: v.optional(v.object({
      grade1: v.optional(v.number()),
      grade2: v.optional(v.number()),
      grade3: v.optional(v.number()),
      grade4: v.optional(v.number()),
      grade5: v.optional(v.number()),
      grade6: v.optional(v.number()),
      grade7: v.optional(v.number()),
      grade8: v.optional(v.number()),
      grade9: v.optional(v.number()),
      grade10: v.optional(v.number()),
      grade11: v.optional(v.number()),
      grade12: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("clients", {
      ...args,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    contact: v.optional(v.string()),
    organization: v.optional(v.string()),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }))),
    gradeAttendance: v.optional(v.object({
      grade1: v.optional(v.number()),
      grade2: v.optional(v.number()),
      grade3: v.optional(v.number()),
      grade4: v.optional(v.number()),
      grade5: v.optional(v.number()),
      grade6: v.optional(v.number()),
      grade7: v.optional(v.number()),
      grade8: v.optional(v.number()),
      grade9: v.optional(v.number()),
      grade10: v.optional(v.number()),
      grade11: v.optional(v.number()),
      grade12: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});
