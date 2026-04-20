import { pgTable, text, serial, integer, real, timestamp, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const foodsTable = pgTable("foods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand"),
  servingSize: real("serving_size").notNull(),
  servingUnit: text("serving_unit").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  fiber: real("fiber"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nutritionLogsTable = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  foodId: integer("food_id").notNull().references(() => foodsTable.id),
  foodName: text("food_name").notNull(),
  date: text("date").notNull(),
  meal: text("meal").notNull(),
  servings: real("servings").notNull(),
  calories: real("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const nutritionGoalsTable = pgTable("nutrition_goals", {
  id: serial("id").primaryKey(),
  trainingCalories: integer("training_calories").notNull().default(2500),
  restCalories: integer("rest_calories").notNull().default(2000),
  proteinG: integer("protein_g").notNull().default(180),
  carbsG: integer("carbs_g").notNull().default(250),
  fatG: integer("fat_g").notNull().default(70),
  fastingWindowHours: integer("fasting_window_hours"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFoodSchema = createInsertSchema(foodsTable).omit({ id: true, createdAt: true });
export const insertNutritionLogSchema = createInsertSchema(nutritionLogsTable).omit({ id: true, createdAt: true });
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;
export type Food = typeof foodsTable.$inferSelect;
export type NutritionLog = typeof nutritionLogsTable.$inferSelect;
export type NutritionGoals = typeof nutritionGoalsTable.$inferSelect;
