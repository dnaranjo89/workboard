import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_DEVBOXES = [
  { name: "Devbox 1", connectionUrl: "" },
  { name: "Devbox 2", connectionUrl: "" },
  { name: "Devbox 3", connectionUrl: "" },
];

const taskStatus = v.union(
  v.literal("active"),
  v.literal("blocked"),
  v.literal("paused"),
  v.literal("done"),
);

function requireAccess(accessKey: string) {
  const configuredKey = process.env.WORKBOARD_ACCESS_KEY;

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

    return {
      devboxes: devboxes
        .sort((a, b) => a._creationTime - b._creationTime)
        .map((devbox) => ({
          ...devbox,
          tasks: sortTasks(
            tasks.filter((task) => task.devboxId === devbox._id),
          ),
        })),
      unassignedTasks: sortTasks(tasks.filter((task) => !task.devboxId)),
    };
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
    connectionUrl: v.optional(v.string()),
  },
  handler: async (ctx, { accessKey, devboxId, name, connectionUrl }) => {
    requireAccess(accessKey);

    await ctx.db.patch(devboxId, {
      name: name.trim() || "Untitled devbox",
      connectionUrl: connectionUrl?.trim(),
      updatedAt: Date.now(),
    });
  },
});

export const addTask = mutation({
  args: {
    accessKey: v.string(),
    devboxId: v.optional(v.id("devboxes")),
  },
  handler: async (ctx, { accessKey, devboxId }) => {
    requireAccess(accessKey);

    const tasks = await ctx.db.query("tasks").collect();
    const slot = nextSlot(tasks.filter((task) => task.devboxId === devboxId));
    const now = Date.now();

    return await ctx.db.insert("tasks", {
      ...(devboxId ? { devboxId } : {}),
      slot,
      title: "",
      status: "active",
      notes: "",
      branch: "",
      updatedAt: now,
    });
  },
});

export const moveTask = mutation({
  args: {
    accessKey: v.string(),
    taskId: v.id("tasks"),
    devboxId: v.optional(v.id("devboxes")),
  },
  handler: async (ctx, { accessKey, taskId, devboxId }) => {
    requireAccess(accessKey);

    const tasks = await ctx.db.query("tasks").collect();
    await ctx.db.patch(taskId, {
      devboxId,
      slot: nextSlot(
        tasks.filter(
          (task) => task._id !== taskId && task.devboxId === devboxId,
        ),
      ),
      updatedAt: Date.now(),
    });
  },
});

export const updateTask = mutation({
  args: {
    accessKey: v.string(),
    taskId: v.id("tasks"),
    title: v.string(),
    status: taskStatus,
    notes: v.optional(v.string()),
    links: v.optional(v.string()),
    branch: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { accessKey, taskId, title, status, notes, links, branch },
  ) => {
    requireAccess(accessKey);

    await ctx.db.patch(taskId, {
      title: title.trim(),
      status,
      notes: notes?.trim(),
      links: links?.trim(),
      branch: branch?.trim(),
      updatedAt: Date.now(),
    });
  },
});

function sortTasks<T extends { slot: number; _creationTime: number }>(
  tasks: T[],
) {
  return tasks.sort((a, b) => a.slot - b.slot || a._creationTime - b._creationTime);
}

function nextSlot(tasks: Array<{ slot: number }>) {
  return tasks.reduce((max, task) => Math.max(max, task.slot), -1) + 1;
}

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
