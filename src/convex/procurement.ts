import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const savePurchasingQuantity = mutation({
  args: {
    materialId: v.id("inventory"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.auth.getUserIdentity();
    if (!user) throw new Error("Unauthorized");

    const existing = await ctx.db
      .query("procurementPurchasingQuantities")
      .withIndex("by_material", (q) => q.eq("materialId", args.materialId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        quantity: args.quantity,
        updatedAt: Date.now(),
        updatedBy: user.subject as any, // Using subject as ID placeholder, ideally should be looked up
      });
    } else {
      // We need a valid user ID for the record. 
      // Since we can't easily get the internal ID from identity subject without a lookup,
      // and this is a quick implementation, we'll look up the user.
      const userRecord = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", user.email))
        .first();
        
      if (!userRecord) throw new Error("User not found");

      await ctx.db.insert("procurementPurchasingQuantities", {
        materialId: args.materialId,
        quantity: args.quantity,
        updatedAt: Date.now(),
        updatedBy: userRecord._id,
      });
    }
  },
});

export const getPurchasingQuantities = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("procurementPurchasingQuantities").collect();
  },
});
