import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, routinesTable } from "@workspace/db";
import {
  CreateRoutineBody,
  UpdateRoutineBody,
  GetRoutineParams,
  UpdateRoutineParams,
  DeleteRoutineParams,
  GetRoutineResponse,
  ListRoutinesResponse,
  UpdateRoutineResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/routines", async (_req, res): Promise<void> => {
  const routines = await db.select().from(routinesTable).orderBy(routinesTable.name);
  res.json(ListRoutinesResponse.parse(routines));
});

router.post("/routines", async (req, res): Promise<void> => {
  const parsed = CreateRoutineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [routine] = await db.insert(routinesTable).values({
    name: parsed.data.name,
    folder: parsed.data.folder ?? null,
    description: parsed.data.description ?? null,
    exercises: parsed.data.exercises ?? [],
  }).returning();

  res.status(201).json(GetRoutineResponse.parse(routine));
});

router.get("/routines/:id", async (req, res): Promise<void> => {
  const params = GetRoutineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [routine] = await db.select().from(routinesTable).where(eq(routinesTable.id, params.data.id));
  if (!routine) {
    res.status(404).json({ error: "Routine not found" });
    return;
  }

  res.json(GetRoutineResponse.parse(routine));
});

router.patch("/routines/:id", async (req, res): Promise<void> => {
  const params = UpdateRoutineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRoutineBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Partial<typeof routinesTable.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.folder !== undefined) updateData.folder = parsed.data.folder ?? null;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description ?? null;
  if (parsed.data.exercises !== undefined) updateData.exercises = parsed.data.exercises;

  const [routine] = await db.update(routinesTable).set(updateData).where(eq(routinesTable.id, params.data.id)).returning();
  if (!routine) {
    res.status(404).json({ error: "Routine not found" });
    return;
  }

  res.json(UpdateRoutineResponse.parse(routine));
});

router.delete("/routines/:id", async (req, res): Promise<void> => {
  const params = DeleteRoutineParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [routine] = await db.delete(routinesTable).where(eq(routinesTable.id, params.data.id)).returning();
  if (!routine) {
    res.status(404).json({ error: "Routine not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
