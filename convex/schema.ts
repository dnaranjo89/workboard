import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  devboxes: defineTable({
    name: v.string(),
    color: v.string(),
    location: v.optional(v.string()),
    updatedAt: v.number(),
  }),
  tasks: defineTable({
    devboxId: v.id("devboxes"),
    slot: v.number(),
    title: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("blocked"),
      v.literal("paused"),
      v.literal("done"),
    ),
    notes: v.optional(v.string()),
    branch: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_devbox", ["devboxId"])
    .index("by_devbox_slot", ["devboxId", "slot"]),
});
