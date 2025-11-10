import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clients").collect();
  },
});

export const get = query({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    clientId: v.optional(v.string()),
    email: v.optional(v.string()),
    contact: v.optional(v.string()),
    organization: v.optional(v.string()),
    address: v.optional(v.string()),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }))),
    gradeAttendance: v.optional(v.object({
      grade1: v.optional(v.number()),
      grade2: v.optional(v.number()),
      grade3: v.optional(v.number()),
      grade4: v.optional(v.number()),
      grade5: v.optional(v.number()),
      grade6: v.optional(v.number()),
      grade7: v.optional(v.number()),
      grade8: v.optional(v.number()),
      grade9: v.optional(v.number()),
      grade10: v.optional(v.number()),
      grade11: v.optional(v.number()),
      grade12: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Generate Client ID
    const organization = args.organization || args.name;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear().toString().slice(-2);
    
    // Extract initials from organization name
    const words = organization.trim().split(/\s+/);
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
    const existingClients = await ctx.db.query("clients").collect();
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

    return await ctx.db.insert("clients", {
      ...args,
      clientId,
      createdBy: userId,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("clients"),
    name: v.optional(v.string()),
    clientId: v.optional(v.string()),
    email: v.optional(v.string()),
    contact: v.optional(v.string()),
    organization: v.optional(v.string()),
    address: v.optional(v.string()),
    type: v.optional(v.union(v.literal("monthly"), v.literal("one_time"))),
    notes: v.optional(v.string()),
    salesPerson: v.optional(v.string()),
    pointsOfContact: v.optional(v.array(v.object({
      name: v.string(),
      designation: v.optional(v.string()),
      phone: v.optional(v.string()),
      email: v.optional(v.string()),
    }))),
    gradeAttendance: v.optional(v.object({
      grade1: v.optional(v.number()),
      grade2: v.optional(v.number()),
      grade3: v.optional(v.number()),
      grade4: v.optional(v.number()),
      grade5: v.optional(v.number()),
      grade6: v.optional(v.number()),
      grade7: v.optional(v.number()),
      grade8: v.optional(v.number()),
      grade9: v.optional(v.number()),
      grade10: v.optional(v.number()),
      grade11: v.optional(v.number()),
      grade12: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("clients") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.delete(args.id);
  },
});
