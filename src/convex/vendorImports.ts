import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vendorImports").collect();
  },
});

export const get = query({
  args: { id: v.id("vendorImports") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getByVendor = query({
  args: { vendorId: v.id("vendors") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vendorImports")
      .withIndex("by_vendor", (q) => q.eq("vendorId", args.vendorId))
      .collect();
  },
});

export const getBillImageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const create = mutation({
  args: {
    vendorId: v.id("vendors"),
    billNumber: v.string(),
    billDate: v.string(),
    billImageId: v.optional(v.id("_storage")),
    items: v.array(
      v.object({
        inventoryId: v.id("inventory"),
        quantity: v.number(),
        unitPrice: v.number(),
      })
    ),
    totalAmount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Create the vendor import record with default payment status
    const importId = await ctx.db.insert("vendorImports", {
      ...args,
      paymentStatus: "requested",
      createdBy: userId,
    });

    // Update inventory quantities for each item
    for (const item of args.items) {
      const inventoryItem = await ctx.db.get(item.inventoryId);
      if (inventoryItem) {
        await ctx.db.patch(item.inventoryId, {
          quantity: inventoryItem.quantity + item.quantity,
        });
      }
    }

    return importId;
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

export const remove = mutation({
  args: { id: v.id("vendorImports") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});

export const updatePaymentStatus = mutation({
  args: {
    id: v.id("vendorImports"),
    status: v.union(
      v.literal("requested"),
      v.literal("acknowledged"),
      v.literal("in_progress"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user?.role || !["admin", "finance"].includes(user.role)) {
      throw new Error("Not authorized to update payment status");
    }

    const vendorImport = await ctx.db.get(args.id);
    if (!vendorImport) throw new Error("Vendor bill not found");

    await ctx.db.patch(args.id, {
      paymentStatus: args.status,
      lastUpdatedBy: userId,
      lastUpdatedAt: Date.now(),
    });

    await ctx.db.insert("activityLogs", {
      userId: vendorImport.createdBy,
      actionType: "vendor_bill_payment_status_updated",
      details: `Vendor bill ${vendorImport.billNumber} payment status updated to ${args.status}`,
      performedBy: userId,
    });

    return args.id;
  },
});