import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, bodyMetricsTable, recoveryLogsTable } from "@workspace/db";
import {
  CreateBodyMetricBody,
  ListBodyMetricsQueryParams,
  CreateRecoveryLogBody,
  ListRecoveryLogsQueryParams,
  ListRecoveryLogsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/body-metrics", async (req, res): Promise<void> => {
  const parsed = ListBodyMetricsQueryParams.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 30;

  const metrics = await db.select().from(bodyMetricsTable).orderBy(desc(bodyMetricsTable.date)).limit(limit);
  res.json(metrics);
});

router.post("/body-metrics", async (req, res): Promise<void> => {
  const parsed = CreateBodyMetricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [metric] = await db.insert(bodyMetricsTable).values(parsed.data).returning();
  res.status(201).json(metric);
});

router.get("/recovery/logs", async (req, res): Promise<void> => {
  const parsed = ListRecoveryLogsQueryParams.safeParse(req.query);
  const limit = parsed.success ? parsed.data.limit : 20;

  const logs = await db.select().from(recoveryLogsTable).orderBy(desc(recoveryLogsTable.date)).limit(limit);
  res.json(ListRecoveryLogsResponse.parse(logs));
});

router.post("/recovery/logs", async (req, res): Promise<void> => {
  const parsed = CreateRecoveryLogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [log] = await db.insert(recoveryLogsTable).values({
    ...parsed.data,
    workoutId: parsed.data.workoutId ?? null,
    durationMinutes: parsed.data.durationMinutes ?? null,
    notes: parsed.data.notes ?? null,
    painLog: parsed.data.painLog ?? null,
    readinessScore: parsed.data.readinessScore ?? null,
  }).returning();

  res.status(201).json(log);
});

export default router;
