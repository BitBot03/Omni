import { Router, type IRouter } from "express";
import { eq, and, desc, gte } from "drizzle-orm";
import { db, habitsTable, habitLogsTable } from "@workspace/db";
import {
  CreateHabitBody,
  UpdateHabitBody,
  UpdateHabitParams,
  DeleteHabitParams,
  ListHabitLogsQueryParams,
  LogHabitBody,
  ListHabitsResponse,
  UpdateHabitResponse,
  ListHabitLogsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function calculateStreak(habitId: number): Promise<number> {
  const logs = await db.select().from(habitLogsTable).where(and(eq(habitLogsTable.habitId, habitId), eq(habitLogsTable.completed, true))).orderBy(desc(habitLogsTable.date));

  if (logs.length === 0) return 0;

  let streak = 0;
  const today = new Date().toISOString().split("T")[0];
  let expectedDate = today;

  for (const log of logs) {
    if (log.date === expectedDate) {
      streak++;
      const d = new Date(expectedDate);
      d.setDate(d.getDate() - 1);
      expectedDate = d.toISOString().split("T")[0];
    } else {
      break;
    }
  }

  return streak;
}

router.get("/habits", async (_req, res): Promise<void> => {
  const habits = await db.select().from(habitsTable).orderBy(habitsTable.createdAt);

  const habitsWithStreaks = await Promise.all(
    habits.map(async (h) => ({ ...h, currentStreak: await calculateStreak(h.id) }))
  );

  res.json(ListHabitsResponse.parse(habitsWithStreaks));
});

router.post("/habits", async (req, res): Promise<void> => {
  const parsed = CreateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db.insert(habitsTable).values(parsed.data).returning();
  res.status(201).json({ ...habit, currentStreak: 0 });
});

router.patch("/habits/:id", async (req, res): Promise<void> => {
  const params = UpdateHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [habit] = await db.update(habitsTable).set(parsed.data).where(eq(habitsTable.id, params.data.id)).returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  const streak = await calculateStreak(habit.id);
  res.json(UpdateHabitResponse.parse({ ...habit, currentStreak: streak }));
});

router.delete("/habits/:id", async (req, res): Promise<void> => {
  const params = DeleteHabitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [habit] = await db.delete(habitsTable).where(eq(habitsTable.id, params.data.id)).returning();
  if (!habit) {
    res.status(404).json({ error: "Habit not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/habits/logs", async (req, res): Promise<void> => {
  const parsed = ListHabitLogsQueryParams.safeParse(req.query);
  const date = req.query.date as string | undefined;
  const habitId = req.query.habitId ? parseInt(req.query.habitId as string, 10) : undefined;

  const conditions = [];
  if (date) conditions.push(eq(habitLogsTable.date, date));
  if (habitId && !isNaN(habitId)) conditions.push(eq(habitLogsTable.habitId, habitId));

  const logs = conditions.length > 0
    ? await db.select().from(habitLogsTable).where(and(...conditions)).orderBy(desc(habitLogsTable.date))
    : await db.select().from(habitLogsTable).orderBy(desc(habitLogsTable.date)).limit(100);

  res.json(ListHabitLogsResponse.parse(logs));
});

router.post("/habits/logs", async (req, res): Promise<void> => {
  const parsed = LogHabitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db.select().from(habitLogsTable).where(
    and(eq(habitLogsTable.habitId, parsed.data.habitId), eq(habitLogsTable.date, parsed.data.date))
  );

  let log;
  if (existing.length > 0) {
    const [updated] = await db.update(habitLogsTable).set({ value: parsed.data.value, completed: parsed.data.completed }).where(eq(habitLogsTable.id, existing[0].id)).returning();
    log = updated;
  } else {
    const [created] = await db.insert(habitLogsTable).values(parsed.data).returning();
    log = created;
  }

  res.status(201).json(log);
});

export default router;
