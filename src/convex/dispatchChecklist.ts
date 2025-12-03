import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List all checklist items
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("dispatchChecklist").collect();
  },
});

// Create a new checklist item
export const create = mutation({
  args: {
    name: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can create checklist items");
    }

    return await ctx.db.insert("dispatchChecklist", {
      name: args.name,
      label: args.label,
    });
  },
});

// Update a checklist item
export const update = mutation({
  args: {
    id: v.id("dispatchChecklist"),
    name: v.string(),
    label: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can update checklist items");
    }

    await ctx.db.patch(args.id, {
      name: args.name,
      label: args.label,
    });
  },
});

// Delete a checklist item
export const remove = mutation({
  args: {
    id: v.id("dispatchChecklist"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();

    if (!user || user.role !== "admin") {
      throw new Error("Only admins can delete checklist items");
    }

    // Check if this is the last item
    const allItems = await ctx.db.query("dispatchChecklist").collect();
    if (allItems.length <= 1) {
      throw new Error("Cannot delete the last checklist item. At least one item must remain.");
    }

    await ctx.db.delete(args.id);
  },
});
