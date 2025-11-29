import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("billTracking").order("desc").collect();
  },
});

export const get = query({
  args: { id: v.id("billTracking") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    companyName: v.string(),
    projectName: v.string(),
    requirement: v.string(),
    billFileId: v.optional(v.id("_storage")),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.role || !["admin", "operations", "manager"].includes(user.role)) {
      throw new Error("Not authorized to create bills");
    }

    const billId = await ctx.db.insert("billTracking", {
      ...args,
      status: "requested",
      createdBy: userId,
    });

    await ctx.db.insert("activityLogs", {
      userId,
      actionType: "bill_created",
      details: `Created bill for ${args.companyName} - ${args.projectName}`,
      performedBy: userId,
    });

    return billId;
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("billTracking"),
    status: v.union(
      v.literal("requested"),
      v.literal("acknowledged"),
      v.literal("in_progress"),
      v.literal("done")
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.role || !["admin", "finance"].includes(user.role)) {
      throw new Error("Not authorized to update bill status");
    }

    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill not found");

    await ctx.db.patch(args.id, {
      status: args.status,
      lastUpdatedBy: userId,
      lastUpdatedAt: Date.now(),
    });

    await ctx.db.insert("activityLogs", {
      userId: bill.createdBy,
      actionType: "bill_status_updated",
      details: `Bill status updated to ${args.status}${args.notes ? `: ${args.notes}` : ""}`,
      performedBy: userId,
    });

    return args.id;
  },
});

export const update = mutation({
  args: {
    id: v.id("billTracking"),
    companyName: v.optional(v.string()),
    projectName: v.optional(v.string()),
    requirement: v.optional(v.string()),
    billFileId: v.optional(v.id("_storage")),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.role || !["admin", "operations", "manager"].includes(user.role)) {
      throw new Error("Not authorized to update bills");
    }

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("billTracking") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const bill = await ctx.db.get(args.id);
    if (!bill) throw new Error("Bill record not found");

    await ctx.db.insert("deletionRequests", {
      entityType: "billTracking",
      entityId: args.id,
      entityName: `${bill.companyName} - ${bill.requirement}`,
      status: "pending",
      requestedBy: userId,
    });
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    
    return await ctx.storage.generateUploadUrl();
  },
});

export const getBillFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});