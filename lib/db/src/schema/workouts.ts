import { pgTable, text, serial, integer, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  notes: text("notes"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  duration: integer("duration"),
  totalVolume: real("total_volume"),
  totalSets: integer("total_sets"),
  routineId: integer("routine_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workoutSetsTable = pgTable("workout_sets", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id").notNull().references(() => workoutsTable.id, { onDelete: "cascade" }),
  exerciseId: integer("exercise_id").notNull(),
  exerciseName: text("exercise_name").notNull(),
  setNumber: integer("set_number").notNull(),
  setType: text("set_type").notNull().default("normal"),
  weight: real("weight"),
  reps: integer("reps"),
  duration: integer("duration"),
  distance: real("distance"),
  rpe: real("rpe"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertWorkoutSchema = createInsertSchema(workoutsTable).omit({ id: true, createdAt: true });
export const insertWorkoutSetSchema = createInsertSchema(workoutSetsTable).omit({ id: true, createdAt: true });
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type InsertWorkoutSet = z.infer<typeof insertWorkoutSetSchema>;
export type Workout = typeof workoutsTable.$inferSelect;
export type WorkoutSet = typeof workoutSetsTable.$inferSelect;
