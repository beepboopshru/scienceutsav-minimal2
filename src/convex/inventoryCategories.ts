import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    categoryType: v.optional(
      v.union(v.literal("raw_material"), v.literal("pre_processed"))
    ),
  },
  handler: async (ctx, args) => {
    if (args.categoryType !== undefined) {
      return await ctx.db
        .query("inventoryCategories")
        .withIndex("by_category_type", (q) =>
          q.eq("categoryType", args.categoryType!)
        )
        .collect();
    }
    return await ctx.db.query("inventoryCategories").collect();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    value: v.string(),
    categoryType: v.union(
      v.literal("raw_material"),
      v.literal("pre_processed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if category with this value already exists
    const existing = await ctx.db
      .query("inventoryCategories")
      .withIndex("by_value", (q) => q.eq("value", args.value))
      .first();

    if (existing) {
      throw new Error("Category with this value already exists");
    }

    return await ctx.db.insert("inventoryCategories", args);
  },
});

export const remove = mutation({
  args: { id: v.id("inventoryCategories") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const category = await ctx.db.get(args.id);
    if (!category) throw new Error("Category not found");

    await ctx.db.insert("deletionRequests", {
      entityType: "inventoryCategory",
      entityId: args.id,
      entityName: category.name,
      status: "pending",
      requestedBy: userId,
    });
  },
});