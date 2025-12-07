import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { auth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const requests = await ctx.db.query("materialRequests").collect();
    return Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        const reviewer = r.reviewedBy ? await ctx.db.get(r.reviewedBy) : null;
        return {
          ...r,
          requesterName: user?.name || "Unknown",
          requesterEmail: user?.email || "Unknown",
          reviewerName: reviewer?.name,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    items: v.array(
      v.object({
        inventoryId: v.id("inventory"),
        name: v.string(),
        quantity: v.number(),
        unit: v.string(),
      })
    ),
    purpose: v.optional(v.string()),
    assignmentId: v.optional(v.id("assignments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    await ctx.db.insert("materialRequests", {
      userId,
      items: args.items,
      status: "pending",
      purpose: args.purpose,
      assignmentId: args.assignmentId,
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("materialRequests"),
    status: v.union(v.literal("approved"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    
    await ctx.db.patch(args.id, {
      status: args.status,
      reviewedBy: userId,
      reviewedAt: Date.now(),
    });
  },
});