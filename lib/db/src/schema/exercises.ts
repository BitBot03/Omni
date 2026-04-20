import { pgTable, text, serial, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const exercisesTable = pgTable("exercises", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  primaryMuscle: text("primary_muscle").notNull(),
  secondaryMuscles: text("secondary_muscles").array().notNull().default([]),
  equipment: text("equipment"),
  trackingType: text("tracking_type").notNull().default("weight_reps"),
  instructions: text("instructions"),
  isCustom: boolean("is_custom").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExerciseSchema = createInsertSchema(exercisesTable).omit({ id: true, createdAt: true });
export type InsertExercise = z.infer<typeof insertExerciseSchema>;
export type Exercise = typeof exercisesTable.$inferSelect;
