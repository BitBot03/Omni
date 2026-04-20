# Project OMNI - All-in-One Fitness OS

## Overview

A premium offline-first fitness and health OS web app. Features dark glassmorphism aesthetic (OLED blacks, neon green #39FF14 and electric blue #00D4FF accents). The web app has been converted to static HTML, CSS, and vanilla JavaScript so the app can load and run from local files without internet. AI coaching is the only feature designed to require internet, and uses a locally stored Bring Your Own Key OpenAI configuration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend artifact**: Plain HTML + CSS + vanilla JavaScript
- **Offline storage**: Browser localStorage
- **Preview server**: Node.js static file server (`artifacts/omni-fitness/server.js`)
- **API framework**: Express 5 API artifact remains in the project but is no longer required by the offline web app
- **Database**: PostgreSQL + Drizzle ORM remains for the API artifact but is no longer required by the offline web app

## App Modules

- **Dashboard** - God Mode overview: streak, readiness, volume, calories, habits, weekly chart
- **Workouts** - Workout history, live workout player, routine builder, exercise list, local workout logging
- **Nutrition** - Daily macro tracking, food database, meal logging, habit completion
- **Recovery** - Recovery metrics, breathing exercise timer, muscle recovery status
- **Analytics** - Muscle saturation, volume charts, performance insights
- **AI Coach** - BYOK OpenAI chat integration; requires internet and a saved API key
- **Settings** - Profile, nutrition goals, AI key/model, local export/import/clear data

## Key Commands

- `pnpm --filter @workspace/omni-fitness run dev` — run the offline static web app preview server
- `pnpm --filter @workspace/omni-fitness run build` — no-op static app build confirmation
- `pnpm --filter @workspace/api-server run dev` — run API server locally if needed for legacy/API work

## Offline Behavior

The web app does not use TypeScript, Tailwind, React, Vue, Angular, Next.js, external fonts, CDN assets, or API calls for core app features. All core app data is stored locally in the browser using localStorage. The app can be opened from the HTML/CSS/JS files directly, with hash-based navigation for offline compatibility.

## Legacy API Routes

The API artifact still contains the prior Express routes for workouts, nutrition, habits, recovery, analytics, and AI. The offline web app no longer depends on them for loading or core functionality.
