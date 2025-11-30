import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const addTypeToClient = mutation({
  args: {
    clientId: v.id("clients"),
    type: v.union(v.literal("monthly"), v.literal("one_time")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(args.clientId, {
      type: args.type,
    });

    return { success: true };
  },
});