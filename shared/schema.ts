import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const decisions = pgTable("decisions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  task: text("task").notNull(),
  resultZh: text("result_zh").notNull(),
  resultEs: text("result_es").notNull(),
  tags: text("tags").array().notNull(),
  costUsd: text("cost_usd").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDecisionSchema = createInsertSchema(decisions).omit({
  id: true,
  createdAt: true,
});

export type InsertDecision = z.infer<typeof insertDecisionSchema>;
export type Decision = typeof decisions.$inferSelect;
