import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bodyMetricsTable = pgTable("body_metrics", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  weight: real("weight"),
  bodyFatPercent: real("body_fat_percent"),
  sleepHours: real("sleep_hours"),
  mood: integer("mood"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryLogsTable = pgTable("recovery_logs", {
  id: serial("id").primaryKey(),
  date: text("date").notNull(),
  type: text("type").notNull(),
  workoutId: integer("workout_id"),
  activities: text("activities").array().notNull().default([]),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  painLog: text("pain_log"),
  readinessScore: integer("readiness_score"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBodyMetricSchema = createInsertSchema(bodyMetricsTable).omit({ id: true, createdAt: true });
export const insertRecoveryLogSchema = createInsertSchema(recoveryLogsTable).omit({ id: true, createdAt: true });
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type InsertRecoveryLog = z.infer<typeof insertRecoveryLogSchema>;
export type BodyMetric = typeof bodyMetricsTable.$inferSelect;
export type RecoveryLog = typeof recoveryLogsTable.$inferSelect;
