import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {
    kitId: v.optional(v.id("kits")),
    fileType: v.optional(v.union(
      v.literal("laser"),
      v.literal("component"),
      v.literal("workbook"),
      v.literal("kitImage")
    )),
  },
  handler: async (ctx, args) => {
    let files;
    
    if (args.kitId !== undefined) {
      files = await ctx.db
        .query("laserFiles")
        .withIndex("by_kit", (q) => q.eq("kitId", args.kitId!))
        .collect();
    } else {
      files = await ctx.db.query("laserFiles").collect();
    }
    
    if (args.fileType) {
      return files.filter(f => f.fileType === args.fileType);
    }
    
    return files;
  },
});

export const get = query({
  args: { id: v.id("laserFiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    kitId: v.id("kits"),
    fileName: v.string(),
    fileType: v.union(
      v.literal("laser"),
      v.literal("component"),
      v.literal("workbook"),
      v.literal("kitImage")
    ),
    storageId: v.optional(v.id("_storage")),
    externalLink: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    if (!args.storageId && !args.externalLink) {
      throw new Error("Either storageId or externalLink must be provided");
    }

    return await ctx.db.insert("laserFiles", {
      ...args,
      uploadedBy: userId,
      uploadedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("laserFiles"),
    fileName: v.optional(v.string()),
    fileType: v.optional(v.union(
      v.literal("laser"),
      v.literal("component"),
      v.literal("workbook"),
      v.literal("kitImage")
    )),
    externalLink: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("laserFiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.id);
    if (!file) throw new Error("File not found");

    // Delete from storage if it's a stored file
    if (file.storageId) {
      await ctx.storage.delete(file.storageId);
    }

    await ctx.db.delete(args.id);
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

export const listWithKitDetails = query({
  args: {
    fileType: v.optional(v.union(
      v.literal("laser"),
      v.literal("component"),
      v.literal("workbook"),
      v.literal("kitImage")
    )),
  },
  handler: async (ctx, args) => {
    const files = await ctx.db.query("laserFiles").collect();
    
    const filteredFiles = args.fileType 
      ? files.filter(f => f.fileType === args.fileType)
      : files;

    const filesWithDetails = await Promise.all(
      filteredFiles.map(async (file) => {
        const kit = await ctx.db.get(file.kitId);
        const uploader = await ctx.db.get(file.uploadedBy);
        return {
          ...file,
          kitName: kit?.name || "Unknown Kit",
          uploaderName: uploader?.name || uploader?.email || "Unknown",
        };
      })
    );

    return filesWithDetails;
  },
});
