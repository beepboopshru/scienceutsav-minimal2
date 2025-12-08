import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { getAllPermissions } from "./permissions";

export const getEffective = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const adminId = await getAuthUserId(ctx);
    if (!adminId) throw new Error("Not authenticated");
    return await getAllPermissions(ctx, args.userId);
  },
});

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
      programs: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        archive: v.boolean(),
      })),
      kits: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        editStock: v.boolean(),
        uploadImages: v.boolean(),
        clone: v.boolean(),
      })),
      clients: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
      })),
      b2cClients: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
      })),
      batches: v.optional(v.object({
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
        updateStatus: v.boolean(),
      })),
      inventory: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        delete: v.boolean(),
        editStock: v.boolean(),
        createCategories: v.boolean(),
        importData: v.boolean(),
        editBOM: v.optional(v.boolean()),
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
      processingJobs: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        complete: v.boolean(),
        delete: v.boolean(),
        editBOM: v.optional(v.boolean()),
        editTargets: v.optional(v.boolean()),
      })),
      procurementJobs: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        complete: v.boolean(),
        delete: v.boolean(),
      })),
      packing: v.optional(v.object({
        view: v.boolean(),
        initiate: v.boolean(),
        validate: v.boolean(),
        transfer: v.boolean(),
        edit: v.optional(v.boolean()),
      })),
      dispatch: v.optional(v.object({
        view: v.boolean(),
        verify: v.boolean(),
        dispatch: v.boolean(),
        updateStatus: v.boolean(),
        edit: v.optional(v.boolean()),
      })),
      discrepancyTickets: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        resolve: v.boolean(),
        delete: v.boolean(),
      })),
      billTracking: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        updateStatus: v.boolean(),
        delete: v.boolean(),
      })),
      billRecords: v.optional(v.object({
        view: v.boolean(),
        download: v.boolean(),
      })),
      vendorImports: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        edit: v.boolean(),
        updatePaymentStatus: v.boolean(),
        delete: v.boolean(),
      })),
      orderHistory: v.optional(v.object({
        view: v.boolean(),
        export: v.boolean(),
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
        clearAssignments: v.boolean(),
        viewActivityLogs: v.boolean(),
        deleteActivityLogs: v.boolean(),
      })),
      userManagement: v.optional(v.object({
        view: v.boolean(),
        approveUsers: v.boolean(),
        manageRoles: v.boolean(),
        managePermissions: v.boolean(),
        deleteUsers: v.boolean(),
      })),
      kitStatistics: v.optional(v.object({
        view: v.boolean(),
        viewStock: v.boolean(),
        editStock: v.boolean(),
        viewFiles: v.boolean(),
        viewCapacityPricing: v.boolean(),
      })),
      lms: v.optional(v.object({
        view: v.boolean(),
        edit: v.boolean(),
      })),
      deletionRequests: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        approve: v.boolean(),
        reject: v.boolean(),
      })),
      materialRequests: v.optional(v.object({
        view: v.boolean(),
        create: v.boolean(),
        approve: v.boolean(),
        reject: v.boolean(),
      })),
      notifications: v.optional(v.object({
        view: v.boolean(),
        receive: v.boolean(),
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