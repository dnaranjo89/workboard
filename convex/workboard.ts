import { env, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_DEVBOXES = [
  { name: "Devbox 1", color: "#2563eb", location: "" },
  { name: "Devbox 2", color: "#16a34a", location: "" },
  { name: "Devbox 3", color: "#d97706", location: "" },
];

const taskStatus = v.union(
  v.literal("active"),
  v.literal("blocked"),
  v.literal("paused"),
  v.literal("done"),
);

function requireAccess(accessKey: string) {
  const configuredKey = env.WORKBOARD_ACCESS_KEY;

  if (!configuredKey) {
    throw new Error("WORKBOARD_ACCESS_KEY is not configured in Convex.");
  }

  if (accessKey !== configuredKey) {
    throw new Error("Invalid access key.");
  }
}

export const list = query({
  args: { accessKey: v.string() },
  handler: async (ctx, { accessKey }) => {
    requireAccess(accessKey);

    const devboxes = await ctx.db.query("devboxes").collect();
    const tasks = await ctx.db.query("tasks").collect();

    return devboxes
      .sort((a, b) => a._creationTime - b._creationTime)
      .map((devbox) => ({
        ...devbox,
        tasks: tasks
          .filter((task) => task.devboxId === devbox._id)
          .sort((a, b) => a.slot - b.slot),
      }));
  },
});

export const seedDefaults = mutation({
  args: { accessKey: v.string() },
  handler: async (ctx, { accessKey }) => {
    requireAccess(accessKey);

    const existing = await ctx.db.query("devboxes").first();
    if (existing) {
      return;
    }

    const now = Date.now();
    for (const devbox of DEFAULT_DEVBOXES) {
      await ctx.db.insert("devboxes", { ...devbox, updatedAt: now });
    }
  },
});

export const updateDevbox = mutation({
  args: {
    accessKey: v.string(),
    devboxId: v.id("devboxes"),
    name: v.string(),
    location: v.optional(v.string()),
    color: v.string(),
  },
  handler: async (ctx, { accessKey, devboxId, name, location, color }) => {
    requireAccess(accessKey);

    await ctx.db.patch(devboxId, {
      name: name.trim() || "Untitled devbox",
      location: location?.trim(),
      color,
      updatedAt: Date.now(),
    });
  },
});

export const upsertTask = mutation({
  args: {
    accessKey: v.string(),
    devboxId: v.id("devboxes"),
    slot: v.number(),
    title: v.string(),
    status: taskStatus,
    notes: v.optional(v.string()),
    branch: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { accessKey, devboxId, slot, title, status, notes, branch },
  ) => {
    requireAccess(accessKey);

    if (slot < 0 || slot > 1) {
      throw new Error("Each devbox supports two tracked task slots.");
    }

    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_devbox_slot", (q) =>
        q.eq("devboxId", devboxId).eq("slot", slot),
      )
      .unique();

    const update = {
      title: title.trim(),
      status,
      notes: notes?.trim(),
      branch: branch?.trim(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, update);
      return existing._id;
    }

    return await ctx.db.insert("tasks", {
      devboxId,
      slot,
      ...update,
    });
  },
});

export const clearTask = mutation({
  args: {
    accessKey: v.string(),
    taskId: v.id("tasks"),
  },
  handler: async (ctx, { accessKey, taskId }) => {
    requireAccess(accessKey);
    await ctx.db.delete(taskId);
  },
});
