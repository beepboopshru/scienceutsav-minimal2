import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { checkPermission } from "./permissions";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "view");

    const jobs = await ctx.db.query("procurementJobs").order("desc").collect();
    
    // Fetch user details for each job
    const jobsWithDetails = await Promise.all(
      jobs.map(async (job) => {
        const creator = await ctx.db.get(job.createdBy);
        return {
          ...job,
          creatorName: creator?.name || "Unknown User",
          creatorEmail: creator?.email || "No Email",
        };
      })
    );
    
    return jobsWithDetails;
  },
});

export const get = query({
  args: { id: v.id("procurementJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "view");

    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    assignmentIds: v.array(v.id("assignments")),
    materialShortages: v.array(
      v.object({
        name: v.string(),
        currentStock: v.optional(v.number()),
        required: v.number(),
        shortage: v.optional(v.number()),
        unit: v.string(),
        category: v.optional(v.string()),
        componentLocation: v.optional(v.string()),
        sourceKits: v.optional(v.array(v.string())),
      })
    ),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
    notes: v.optional(v.string()),
    remarks: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "create");

    // Generate job ID
    const jobCount = await ctx.db.query("procurementJobs").collect();
    const jobId = `PROC-${String(jobCount.length + 1).padStart(5, "0")}`;

    const jobData = {
      jobId,
      name: args.name || `Procurement Job ${jobId}`,
      createdBy: userId,
      assignmentIds: args.assignmentIds,
      materialShortages: args.materialShortages,
      status: "pending" as const,
      priority: args.priority,
      notes: args.notes,
      remarks: args.remarks,
    };

    return await ctx.db.insert("procurementJobs", jobData);
  },
});

export const markAsComplete = mutation({
  args: {
    id: v.id("procurementJobs"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "edit");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Procurement job not found");

    // Update job status to completed
    await ctx.db.patch(args.id, {
      status: "completed",
    });

    // Log activity
    await ctx.db.insert("activityLogs", {
      userId: userId,
      actionType: "procurement_completed",
      details: `Marked procurement job ${job.jobId} as complete`,
      performedBy: userId,
    });

    return { success: true };
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("procurementJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("in_progress"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "edit");

    await ctx.db.patch(args.id, {
      status: args.status,
    });
  },
});

export const updateNotes = mutation({
  args: {
    id: v.id("procurementJobs"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "edit");

    await ctx.db.patch(args.id, {
      notes: args.notes,
    });
  },
});

export const updatePriority = mutation({
  args: {
    id: v.id("procurementJobs"),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "edit");

    await ctx.db.patch(args.id, {
      priority: args.priority,
    });
  },
});

export const remove = mutation({
  args: { id: v.id("procurementJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await checkPermission(ctx, userId, "procurementJobs", "delete");

    const job = await ctx.db.get(args.id);
    if (!job) throw new Error("Procurement job not found");

    return await ctx.db.insert("deletionRequests", {
      entityType: "procurementJob",
      entityId: args.id,
      entityName: `Procurement Job ${job.jobId}`,
      status: "pending",
      requestedBy: userId,
      reason: "User requested deletion",
    });
  },
});