import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, workoutsTable, workoutSetsTable, exercisesTable } from "@workspace/db";
import {
  CreateWorkoutBody,
  UpdateWorkoutBody,
  GetWorkoutParams,
  UpdateWorkoutParams,
  DeleteWorkoutParams,
  ListWorkoutsQueryParams,
  GetWorkoutResponse,
  ListWorkoutsResponse,
  UpdateWorkoutResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function enrichWorkoutWithSets(workout: typeof workoutsTable.$inferSelect) {
  const sets = await db.select().from(workoutSetsTable).where(eq(workoutSetsTable.workoutId, workout.id)).orderBy(workoutSetsTable.setNumber);
  return { ...workout, sets };
}

router.get("/workouts", async (req, res): Promise<void> => {
  const parsed = ListWorkoutsQueryParams.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 20;
  const offset = parsed.success ? parsed.data.offset : 0;

  const workouts = await db.select().from(workoutsTable).orderBy(desc(workoutsTable.startedAt)).limit(limit).offset(offset);
  const enriched = await Promise.all(workouts.map(enrichWorkoutWithSets));

  res.json(ListWorkoutsResponse.parse(enriched));
});

router.post("/workouts", async (req, res): Promise<void> => {
  const parsed = CreateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sets, ...workoutData } = parsed.data;

  const [workout] = await db.insert(workoutsTable).values(workoutData).returning();

  if (sets && sets.length > 0) {
    const exerciseNames = new Map<number, string>();
    for (const s of sets) {
      if (!exerciseNames.has(s.exerciseId)) {
        const [ex] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, s.exerciseId));
        exerciseNames.set(s.exerciseId, ex?.name ?? "Unknown");
      }
    }

    await db.insert(workoutSetsTable).values(
      sets.map((s) => ({
        workoutId: workout.id,
        exerciseId: s.exerciseId,
        exerciseName: exerciseNames.get(s.exerciseId) ?? "Unknown",
        setNumber: s.setNumber,
        setType: s.setType ?? "normal",
        weight: s.weight ?? null,
        reps: s.reps ?? null,
        duration: s.duration ?? null,
        distance: s.distance ?? null,
        rpe: s.rpe ?? null,
        notes: s.notes ?? null,
      }))
    );

    const totalVolume = sets.reduce((sum, s) => sum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
    await db.update(workoutsTable).set({ totalVolume, totalSets: sets.length }).where(eq(workoutsTable.id, workout.id));
  }

  const enriched = await enrichWorkoutWithSets(workout);
  res.status(201).json(GetWorkoutResponse.parse(enriched));
});

router.get("/workouts/:id", async (req, res): Promise<void> => {
  const params = GetWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workout] = await db.select().from(workoutsTable).where(eq(workoutsTable.id, params.data.id));
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  const enriched = await enrichWorkoutWithSets(workout);
  res.json(GetWorkoutResponse.parse(enriched));
});

router.patch("/workouts/:id", async (req, res): Promise<void> => {
  const params = UpdateWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateWorkoutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { sets, ...workoutData } = parsed.data;

  const [workout] = await db.update(workoutsTable).set(workoutData).where(eq(workoutsTable.id, params.data.id)).returning();
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  if (sets !== undefined) {
    await db.delete(workoutSetsTable).where(eq(workoutSetsTable.workoutId, workout.id));

    if (sets.length > 0) {
      const exerciseNames = new Map<number, string>();
      for (const s of sets) {
        if (!exerciseNames.has(s.exerciseId)) {
          const [ex] = await db.select().from(exercisesTable).where(eq(exercisesTable.id, s.exerciseId));
          exerciseNames.set(s.exerciseId, ex?.name ?? "Unknown");
        }
      }

      await db.insert(workoutSetsTable).values(
        sets.map((s) => ({
          workoutId: workout.id,
          exerciseId: s.exerciseId,
          exerciseName: exerciseNames.get(s.exerciseId) ?? "Unknown",
          setNumber: s.setNumber,
          setType: s.setType ?? "normal",
          weight: s.weight ?? null,
          reps: s.reps ?? null,
          duration: s.duration ?? null,
          distance: s.distance ?? null,
          rpe: s.rpe ?? null,
          notes: s.notes ?? null,
        }))
      );

      const totalVolume = sets.reduce((sum, s) => sum + ((s.weight ?? 0) * (s.reps ?? 0)), 0);
      await db.update(workoutsTable).set({ totalVolume, totalSets: sets.length }).where(eq(workoutsTable.id, workout.id));
    }
  }

  const enriched = await enrichWorkoutWithSets(workout);
  res.json(UpdateWorkoutResponse.parse(enriched));
});

router.delete("/workouts/:id", async (req, res): Promise<void> => {
  const params = DeleteWorkoutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [workout] = await db.delete(workoutsTable).where(eq(workoutsTable.id, params.data.id)).returning();
  if (!workout) {
    res.status(404).json({ error: "Workout not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
