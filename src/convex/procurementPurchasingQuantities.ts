import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("procurementPurchasingQuantities").collect();
  },
});

export const getByMaterialName = query({
  args: { materialName: v.string() },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("procurementPurchasingQuantities")
      .withIndex("by_material_name", (q) => q.eq("materialName", args.materialName))
      .first();
    return result;
  },
});

export const upsert = mutation({
  args: {
    materialName: v.string(),
    purchasingQty: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if entry exists
    const existing = await ctx.db
      .query("procurementPurchasingQuantities")
      .withIndex("by_material_name", (q) => q.eq("materialName", args.materialName))
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        purchasingQty: args.purchasingQty,
        updatedBy: userId,
      });
      return existing._id;
    } else {
      // Create new
      return await ctx.db.insert("procurementPurchasingQuantities", {
        materialName: args.materialName,
        purchasingQty: args.purchasingQty,
        updatedBy: userId,
      });
    }
  },
});

export const batchUpsert = mutation({
  args: {
    quantities: v.array(
      v.object({
        materialName: v.string(),
        purchasingQty: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    for (const item of args.quantities) {
      const existing = await ctx.db
        .query("procurementPurchasingQuantities")
        .withIndex("by_material_name", (q) => q.eq("materialName", item.materialName))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          purchasingQty: item.purchasingQty,
          updatedBy: userId,
        });
      } else {
        await ctx.db.insert("procurementPurchasingQuantities", {
          materialName: item.materialName,
          purchasingQty: item.purchasingQty,
          updatedBy: userId,
        });
      }
    }
  },
});

export const remove = mutation({
  args: { materialName: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("procurementPurchasingQuantities")
      .withIndex("by_material_name", (q) => q.eq("materialName", args.materialName))
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
