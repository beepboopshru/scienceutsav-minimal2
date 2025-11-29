import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vendors").collect();
  },
});

export const get = query({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    organization: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    gstn: v.optional(v.string()),
    notes: v.optional(v.string()),
    inventoryItems: v.optional(v.array(v.id("inventory"))),
    itemPrices: v.optional(v.array(v.object({
      itemId: v.id("inventory"),
      averagePrice: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("vendors", {
      ...args,
      itemPrices: args.itemPrices || [],
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("vendors"),
    name: v.optional(v.string()),
    organization: v.optional(v.string()),
    contactPerson: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.string()),
    gstn: v.optional(v.string()),
    notes: v.optional(v.string()),
    inventoryItems: v.optional(v.array(v.id("inventory"))),
    itemPrices: v.optional(v.array(v.object({
      itemId: v.id("inventory"),
      averagePrice: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("vendors") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vendor = await ctx.db.get(args.id);
    if (!vendor) throw new Error("Vendor not found");

    // Create deletion request instead of deleting immediately
    await ctx.db.insert("deletionRequests", {
      entityType: "vendor",
      entityId: args.id,
      entityName: vendor.name,
      requestedBy: userId,
      status: "pending",
      reason: "Deletion requested by user",
    });
  },
});

export const addInventoryItem = mutation({
  args: {
    vendorId: v.id("vendors"),
    itemId: v.id("inventory"),
    averagePrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) throw new Error("Vendor not found");

    const inventoryItems = vendor.inventoryItems || [];
    if (!inventoryItems.includes(args.itemId)) {
      inventoryItems.push(args.itemId);
    }

    const itemPrices = vendor.itemPrices || [];
    if (args.averagePrice !== undefined) {
      const existingPriceIndex = itemPrices.findIndex(
        (p) => p.itemId === args.itemId
      );
      if (existingPriceIndex >= 0) {
        itemPrices[existingPriceIndex].averagePrice = args.averagePrice;
      } else {
        itemPrices.push({
          itemId: args.itemId,
          averagePrice: args.averagePrice,
        });
      }
    }

    await ctx.db.patch(args.vendorId, {
      inventoryItems,
      itemPrices,
    });
  },
});

export const removeInventoryItem = mutation({
  args: {
    vendorId: v.id("vendors"),
    itemId: v.id("inventory"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) throw new Error("Vendor not found");

    const inventoryItems = (vendor.inventoryItems || []).filter(
      (id) => id !== args.itemId
    );
    const itemPrices = (vendor.itemPrices || []).filter(
      (p) => p.itemId !== args.itemId
    );

    await ctx.db.patch(args.vendorId, {
      inventoryItems,
      itemPrices,
    });
  },
});

export const updateItemPrice = mutation({
  args: {
    vendorId: v.id("vendors"),
    itemId: v.id("inventory"),
    averagePrice: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const vendor = await ctx.db.get(args.vendorId);
    if (!vendor) throw new Error("Vendor not found");

    const itemPrices = vendor.itemPrices || [];
    const existingPriceIndex = itemPrices.findIndex(
      (p) => p.itemId === args.itemId
    );

    if (existingPriceIndex >= 0) {
      itemPrices[existingPriceIndex].averagePrice = args.averagePrice;
    } else {
      itemPrices.push({
        itemId: args.itemId,
        averagePrice: args.averagePrice,
      });
    }

    await ctx.db.patch(args.vendorId, { itemPrices });
  },
});

export const getVendorsForItem = query({
  args: { itemId: v.id("inventory") },
  handler: async (ctx, args) => {
    const allVendors = await ctx.db.query("vendors").collect();
    return allVendors.filter(
      (vendor) =>
        vendor.inventoryItems && vendor.inventoryItems.includes(args.itemId)
    );
  },
});