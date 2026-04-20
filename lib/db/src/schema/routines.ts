import { pgTable, text, serial, integer, real, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const routinesTable = pgTable("routines", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  folder: text("folder"),
  description: text("description"),
  exercises: jsonb("exercises").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoutineSchema = createInsertSchema(routinesTable).omit({ id: true, createdAt: true });
export type InsertRoutine = z.infer<typeof insertRoutineSchema>;
export type Routine = typeof routinesTable.$inferSelect;
