import { Router, type IRouter } from "express";
import { ilike, or, eq, and } from "drizzle-orm";
import { db, exercisesTable } from "@workspace/db";
import {
  CreateExerciseBody,
  GetExerciseParams,
  GetExerciseResponse,
  ListExercisesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/exercises", async (req, res): Promise<void> => {
  const { muscle, equipment, search } = req.query as Record<string, string | undefined>;

  let query = db.select().from(exercisesTable);
  const conditions = [];

  if (muscle) {
    conditions.push(eq(exercisesTable.primaryMuscle, muscle));
  }
  if (equipment) {
    conditions.push(eq(exercisesTable.equipment, equipment));
  }
  if (search) {
    conditions.push(ilike(exercisesTable.name, `%${search}%`));
  }

  const exercises = conditions.length > 0
    ? await db.select().from(exercisesTable).where(and(...conditions)).orderBy(exercisesTable.name)
    : await db.select().from(exercisesTable).orderBy(exercisesTable.name);

  res.json(ListExercisesResponse.parse(exercises));
});

router.post("/exercises", async (req, res): Promise<void> => {
  const parsed = CreateExerciseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [exercise] = await db.insert(exercisesTable).values({
    ...parsed.data,
    isCustom: true,
  }).returning();

  res.status(201).json(GetExerciseResponse.parse(exercise));
});

router.get("/exercises/:id", async (req, res): Promise<void> => {
  const params = GetExerciseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [exercise] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, params.data.id));
  if (!exercise) {
    res.status(404).json({ error: "Exercise not found" });
    return;
  }

  res.json(GetExerciseResponse.parse(exercise));
});

export default router;
