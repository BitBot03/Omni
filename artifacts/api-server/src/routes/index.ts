import { Router, type IRouter } from "express";
import healthRouter from "./health";
import exercisesRouter from "./exercises";
import workoutsRouter from "./workouts";
import routinesRouter from "./routines";
import nutritionRouter from "./nutrition";
import habitsRouter from "./habits";
import recoveryRouter from "./recovery";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(exercisesRouter);
router.use(workoutsRouter);
router.use(routinesRouter);
router.use(nutritionRouter);
router.use(habitsRouter);
router.use(recoveryRouter);
router.use(analyticsRouter);
router.use(aiRouter);

export default router;
