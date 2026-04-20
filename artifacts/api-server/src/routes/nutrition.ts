import { Router, type IRouter } from "express";
import { eq, ilike, desc } from "drizzle-orm";
import { db, foodsTable, nutritionLogsTable, nutritionGoalsTable } from "@workspace/db";
import {
  CreateNutritionLogBody,
  DeleteNutritionLogParams,
  ListNutritionLogsQueryParams,
  ListFoodsQueryParams,
  UpdateNutritionGoalsBody,
  ListNutritionLogsResponse,
  ListFoodsResponse,
  GetNutritionGoalsResponse,
  UpdateNutritionGoalsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/nutrition/logs", async (req, res): Promise<void> => {
  const parsed = ListNutritionLogsQueryParams.safeParse(req.query);
  const date = req.query.date as string | undefined;
  const limit = parsed.success ? parsed.data.limit : 20;

  let logs;
  if (date) {
    logs = await db.select().from(nutritionLogsTable).where(eq(nutritionLogsTable.date, date)).orderBy(desc(nutritionLogsTable.createdAt)).limit(limit);
  } else {
    logs = await db.select().from(nutritionLogsTable).orderBy(desc(nutritionLogsTable.createdAt)).limit(limit);
  }

  res.json(ListNutritionLogsResponse.parse(logs));
});

router.post("/nutrition/logs", async (req, res): Promise<void> => {
  const parsed = CreateNutritionLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [food] = await db.select().from(foodsTable).where(eq(foodsTable.id, parsed.data.foodId));
  if (!food) {
    res.status(404).json({ error: "Food not found" });
    return;
  }

  const multiplier = parsed.data.servings;
  const [log] = await db.insert(nutritionLogsTable).values({
    foodId: parsed.data.foodId,
    foodName: food.name,
    date: parsed.data.date,
    meal: parsed.data.meal,
    servings: multiplier,
    calories: food.calories * multiplier,
    protein: food.protein * multiplier,
    carbs: food.carbs * multiplier,
    fat: food.fat * multiplier,
  }).returning();

  res.status(201).json(log);
});

router.delete("/nutrition/logs/:id", async (req, res): Promise<void> => {
  const params = DeleteNutritionLogParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [log] = await db.delete(nutritionLogsTable).where(eq(nutritionLogsTable.id, params.data.id)).returning();
  if (!log) {
    res.status(404).json({ error: "Log not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/nutrition/foods", async (req, res): Promise<void> => {
  const parsed = ListFoodsQueryParams.safeParse(req.query);
  const search = req.query.search as string | undefined;
  const limit = parsed.success ? parsed.data.limit : 20;

  let foods;
  if (search) {
    foods = await db.select().from(foodsTable).where(ilike(foodsTable.name, `%${search}%`)).limit(limit);
  } else {
    foods = await db.select().from(foodsTable).limit(limit);
  }

  res.json(ListFoodsResponse.parse(foods));
});

router.get("/nutrition/goals", async (_req, res): Promise<void> => {
  const goals = await db.select().from(nutritionGoalsTable).limit(1);

  if (goals.length === 0) {
    const [created] = await db.insert(nutritionGoalsTable).values({}).returning();
    res.json(GetNutritionGoalsResponse.parse(created));
    return;
  }

  res.json(GetNutritionGoalsResponse.parse(goals[0]));
});

router.put("/nutrition/goals", async (req, res): Promise<void> => {
  const parsed = UpdateNutritionGoalsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(nutritionGoalsTable).limit(1);
  let result;

  if (existing.length === 0) {
    const [created] = await db.insert(nutritionGoalsTable).values(parsed.data).returning();
    result = created;
  } else {
    const [updated] = await db.update(nutritionGoalsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(nutritionGoalsTable.id, existing[0].id)).returning();
    result = updated;
  }

  res.json(UpdateNutritionGoalsResponse.parse(result));
});

export default router;
