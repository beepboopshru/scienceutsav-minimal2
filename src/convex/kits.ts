import { v } from "convex/values";
import { mutation, query, MutationCtx } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Helper to sync sealed packets from packing requirements to inventory
async function syncSealedPackets(ctx: MutationCtx, packingRequirements?: string) {
  if (!packingRequirements) return;

  let structure;
  try {
    structure = JSON.parse(packingRequirements);
  } catch (e) {
    return;
  }

  const packets = structure.packets || [];
  if (!Array.isArray(packets)) return;

  for (const packet of packets) {
    if (!packet.name) continue;

    // Check if exists
    const packetItem = await ctx.db
      .query("inventory")
      .withIndex("by_name", (q) => q.eq("name", packet.name))
      .first();

    // Resolve components
    const components = [];
    if (packet.materials && Array.isArray(packet.materials)) {
      for (const mat of packet.materials) {
        if (!mat.name) continue;
        const matItem = await ctx.db
          .query("inventory")
          .withIndex("by_name", (q) => q.eq("name", mat.name))
          .first();

        if (matItem) {
          components.push({
            rawMaterialId: matItem._id,
            quantityRequired: mat.quantity || 0,
            unit: mat.unit || "pcs",
          });
        }
      }
    }

    if (packetItem) {
      // Update existing if it is a sealed packet
      if (packetItem.type === "sealed_packet") {
        await ctx.db.patch(packetItem._id, {
          components: components,
        });
      }
    } else {
      // Create new sealed packet
      await ctx.db.insert("inventory", {
        name: packet.name,
        type: "sealed_packet",
        quantity: 0,
        unit: "pcs",
        components: components,
        description: "Auto-generated from Kit Builder",
      });
    }
  }
}

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
    conceptName: v.optional(v.string()),
    subject: v.optional(v.string()),
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
      subcategory: v.optional(v.string()),
      notes: v.optional(v.string()),
    }))),
    bulkMaterials: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      subcategory: v.optional(v.string()),
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

    // Sync sealed packets if structured
    if (args.isStructured && args.packingRequirements) {
      await syncSealedPackets(ctx, args.packingRequirements);
    }

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
    conceptName: v.optional(v.string()),
    subject: v.optional(v.string()),
    description: v.optional(v.string()),
    remarks: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    images: v.optional(v.array(v.string())),
    fileIds: v.optional(v.array(v.id("_storage"))),
    kitImageFiles: v.optional(v.array(v.union(
      v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
      v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
    ))),
    laserFiles: v.optional(v.array(v.union(
      v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
      v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
    ))),
    componentFiles: v.optional(v.array(v.union(
      v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
      v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
    ))),
    workbookFiles: v.optional(v.array(v.union(
      v.object({ type: v.literal("storage"), storageId: v.id("_storage") }),
      v.object({ type: v.literal("link"), name: v.string(), url: v.string() })
    ))),
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
      subcategory: v.optional(v.string()),
      notes: v.optional(v.string()),
    }))),
    bulkMaterials: v.optional(v.array(v.object({
      name: v.string(),
      quantity: v.number(),
      unit: v.string(),
      subcategory: v.optional(v.string()),
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

    // Sync sealed packets if structured
    if (updates.isStructured && updates.packingRequirements) {
      await syncSealedPackets(ctx, updates.packingRequirements);
    } else if (updates.packingRequirements) {
      // Also sync if just packing requirements updated, but check if kit is structured
      const kit = await ctx.db.get(id);
      if (kit && (kit.isStructured || updates.isStructured)) {
        await syncSealedPackets(ctx, updates.packingRequirements);
      }
    }

    await ctx.db.patch(id, updates);
  },
});

export const clone = mutation({
  args: {
    id: v.id("kits"),
    targetProgramId: v.id("programs"),
    newName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const originalKit = await ctx.db.get(args.id);
    if (!originalKit) throw new Error("Kit not found");

    // Create a new kit with all properties from the original
    const newKit = {
      name: args.newName || `${originalKit.name} (Copy)`,
      programId: args.targetProgramId,
      serialNumber: originalKit.serialNumber,
      type: originalKit.type,
      cstemVariant: originalKit.cstemVariant,
      category: originalKit.category,
      conceptName: originalKit.conceptName,
      subject: originalKit.subject,
      description: originalKit.description,
      remarks: originalKit.remarks,
      imageUrl: originalKit.imageUrl,
      images: originalKit.images,
      fileIds: originalKit.fileIds,
      stockCount: 0,
      lowStockThreshold: originalKit.lowStockThreshold || 5,
      status: originalKit.status,
      tags: originalKit.tags,
      notes: originalKit.notes,
      isStructured: originalKit.isStructured,
      packingRequirements: originalKit.packingRequirements,
      spareKits: originalKit.spareKits,
      bulkMaterials: originalKit.bulkMaterials,
      miscellaneous: originalKit.miscellaneous,
      components: originalKit.components,
      createdBy: userId,
    };

    return await ctx.db.insert("kits", newKit);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
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

export const updateLmsLink = mutation({
  args: {
    id: v.id("kits"),
    lmsLink: v.optional(v.string()),
    lmsNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});