import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("b2cClients").collect();
  },
});

export const get = query({
  args: { id: v.id("b2cClients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    buyerName: v.string(),
    clientId: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      line3: v.optional(v.string()),
      state: v.string(),
      pincode: v.string(),
      country: v.string(),
    })),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate Client ID
    const buyerName = args.buyerName;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear().toString().slice(-2);
    
    // Extract initials from buyer name
    const words = buyerName.trim().split(/\s+/);
    let initials = "";
    if (words.length === 1) {
      // Single word: use first letter
      initials = words[0].charAt(0).toUpperCase();
    } else {
      // Multiple words: use first letter of each word
      initials = words
        .map(word => word.charAt(0).toUpperCase())
        .filter(char => /[A-Z]/.test(char))
        .join("");
    }
    
    // Base client ID without sequence number
    const baseClientId = `${initials}.${month}.${year}`;
    
    // Check for existing clients with same base ID
    const existingClients = await ctx.db.query("b2cClients").collect();
    const matchingIds = existingClients
      .filter(c => c.clientId?.startsWith(baseClientId))
      .map(c => c.clientId || "");
    
    let clientId = baseClientId;
    if (matchingIds.length > 0) {
      // Find the highest sequence number
      const sequenceNumbers = matchingIds
        .map(id => {
          const parts = id.split(".");
          if (parts.length === 4) {
            return parseInt(parts[3]);
          }
          return 0;
        })
        .filter(num => !isNaN(num));
      
      const maxSequence = sequenceNumbers.length > 0 ? Math.max(...sequenceNumbers) : 0;
      const nextSequence = maxSequence + 1;
      clientId = `${baseClientId}.${nextSequence.toString().padStart(3, "0")}`;
    }

    return await ctx.db.insert("b2cClients", {
      ...args,
      clientId,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("b2cClients"),
    buyerName: v.optional(v.string()),
    clientId: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    address: v.optional(v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      line3: v.optional(v.string()),
      state: v.string(),
      pincode: v.string(),
      country: v.string(),
    })),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
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
  args: { id: v.id("b2cClients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});
