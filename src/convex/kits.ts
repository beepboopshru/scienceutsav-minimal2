import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("kits").collect();
  },
});

export const get = query({
  args: { id: v.id("kits") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    programId: v.id("programs"),
    serialNumber: v.optional(v.string()),
    serialNumbers: v.optional(v.array(v.string())),
    type: v.optional(v.string()),
    cstemVariant: v.optional(v.union(v.literal("explorer"), v.literal("discoverer"))),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    remarks: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.id("_storage"))),
    stockCount: v.number(),
    lowStockThreshold: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    isStructured: v.optional(v.boolean()),
    packingRequirements: v.optional(v.string()),
    spareKits: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    bulkMaterials: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    miscellaneous: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    components: v.optional(
      v.array(
        v.object({
          inventoryItemId: v.id("inventory"),
          quantityPerKit: v.number(),
          unit: v.string(),
          wastageNotes: v.optional(v.string()),
          comments: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("kits", {
      ...args,
      status: "active",
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("kits"),
    name: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    serialNumbers: v.optional(v.array(v.string())),
    type: v.optional(v.string()),
    cstemVariant: v.optional(v.union(v.literal("explorer"), v.literal("discoverer"))),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    remarks: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.id("_storage"))),
    stockCount: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
    status: v.optional(v.union(
      v.literal("active"), 
      v.literal("archived"),
      v.literal("in_stock"),
      v.literal("assigned"),
      v.literal("to_be_made")
    )),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    isStructured: v.optional(v.boolean()),
    packingRequirements: v.optional(v.string()),
    spareKits: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    bulkMaterials: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    miscellaneous: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      notes: v.optional(v.string()),
    }))),
    components: v.optional(
      v.array(
        v.object({
          inventoryItemId: v.id("inventory"),
          quantityPerKit: v.number(),
          unit: v.string(),
          wastageNotes: v.optional(v.string()),
          comments: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const clone = mutation({
  args: { id: v.id("kits") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const original = await ctx.db.get(args.id);
    if (!original) throw new Error("Kit not found");

    return await ctx.db.insert("kits", {
      ...original,
      name: `${original.name} (Copy)`,
      createdBy: userId,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getWithInventory = query({
  args: { id: v.id("kits") },
  handler: async (ctx, args) => {
    const kit = await ctx.db.get(args.id);
    if (!kit) return null;

    const components = kit.components || [];
    const inventoryItems = await Promise.all(
      components.map(async (comp) => {
        const item = await ctx.db.get(comp.inventoryItemId);
        return { ...comp, inventoryItem: item };
      })
    );

    return { ...kit, componentsWithInventory: inventoryItems };
  },
});

export const remove = mutation({
  args: { id: v.id("kits") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});