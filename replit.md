# Project OMNI - All-in-One Fitness OS

## Overview

A premium full-stack fitness and health OS web app. Features dark glassmorphism aesthetic (OLED blacks, neon green #39FF14 and electric blue #00D4FF accents). Built with React + Vite frontend and Express 5 backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite, Tailwind CSS, Radix UI, Recharts, Framer Motion, Wouter
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## App Modules

- **Dashboard** - God Mode overview: streak, readiness, volume, calories, habits, weekly chart
- **Workouts** - Workout history, live workout player, routine builder, exercise library (20+ built-in)
- **Nutrition** - Daily macro tracking, food database (25+ foods), meal logging, nutrition goals
- **Recovery** - Body metrics log, recovery logs, breathing exercises, pain journal
- **Analytics** - Muscle heatmap, habit heatmap (365-day), volume charts, correlation insights, PRs
- **AI Coach** - BYOK (Bring Your Own Key) OpenAI GPT integration with context-aware prompting
- **Settings** - Profile, nutrition goals, data management

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

Tables: `exercises`, `workouts`, `workout_sets`, `routines`, `foods`, `nutrition_logs`, `nutrition_goals`, `habits`, `habit_logs`, `body_metrics`, `recovery_logs`

## API Routes

- `GET/POST /api/exercises` — Exercise library
- `GET/POST/PATCH/DELETE /api/workouts` — Workout management
- `GET/POST/PATCH/DELETE /api/routines` — Workout routines
- `GET/POST/DELETE /api/nutrition/logs` — Food logging
- `GET /api/nutrition/foods` — Food database search
- `GET/PUT /api/nutrition/goals` — Macro goals
- `GET/POST/PATCH/DELETE /api/habits` — Habit management
- `GET/POST /api/habits/logs` — Habit completion logs
- `GET/POST /api/body-metrics` — Weight, sleep, mood tracking
- `GET/POST /api/recovery/logs` — Recovery session logs
- `GET /api/analytics/dashboard` — Dashboard summary
- `GET /api/analytics/volume` — Volume progression data
- `GET /api/analytics/muscle-heatmap` — Muscle recovery status
- `GET /api/analytics/habit-heatmap` — 365-day habit grid
- `GET /api/analytics/correlations` — AI-derived insights
- `GET /api/analytics/streaks` — Streak tracking and PRs
- `POST /api/ai/chat` — AI coach (OpenAI BYOK)

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
