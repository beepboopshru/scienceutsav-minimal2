import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userPermissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const update = mutation({
  args: {
    userId: v.id("users"),
    permissions: v.object({
      dashboard: v.optional(v.object({ view: v.boolean() })),
      kits: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        editStock: v.boolean(),
        uploadImages: v.boolean(),
      })),
      clients: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
      })),
      assignments: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        pack: v.boolean(),
        dispatch: v.boolean(),
      })),
      inventory: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        editStock: v.boolean(),
        createCategories: v.boolean(),
        importData: v.boolean(),
      })),
      vendors: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
      })),
      services: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
      })),
      laserFiles: v.optional(v.object({
        view: v.boolean(),
        upload: v.boolean(),
        delete: v.boolean(),
      })),
      reports: v.optional(v.object({
        view: v.boolean(),
        download: v.boolean(),
      })),
      adminZone: v.optional(v.object({
        view: v.boolean(),
        manageUsers: v.boolean(),
        manageRoles: v.boolean(),
        managePermissions: v.boolean(),
        approveUsers: v.boolean(),
        deleteUsers: v.boolean(),
        clearAssignments: v.boolean(),
        viewActivityLogs: v.boolean(),
        deleteActivityLogs: v.boolean(),
      })),
    }),
  },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");

    const admin = await ctx.db.get(adminId);
    if (admin?.role !== "admin") throw new Error("Not authorized");

    const existing = await ctx.db
      .query("userPermissions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { permissions: args.permissions });
      return existing._id;
    } else {
      return await ctx.db.insert("userPermissions", {
        userId: args.userId,
        permissions: args.permissions,
      });
    }
  },
});
