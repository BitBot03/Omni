# Project OMNI - All-in-One Fitness OS

## Overview

A premium offline-first fitness and health OS web app. Features a polished dark glassmorphism interface with OLED blacks, neon green #39FF14, electric blue #00D4FF, refined card hierarchy, vector-style navigation icons, responsive mobile navigation, and professional typography. The web app uses static HTML, CSS, and vanilla JavaScript so the app can load and run from local files without internet. AI coaching is the only feature designed to require internet, and uses a locally stored Bring Your Own Key OpenAI configuration.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend artifact**: Plain HTML + CSS + vanilla JavaScript
- **Offline storage**: Browser localStorage
- **Preview server**: Node.js static file server (`artifacts/omni-fitness/server.js`)
- **Typography**: Google Fonts import for Inter + Space Grotesk when online, with system font fallbacks for offline use
- **API framework**: Express 5 API artifact remains in the project but is no longer required by the offline web app
- **Database**: PostgreSQL + Drizzle ORM remains for the API artifact but is no longer required by the offline web app

## App Modules

- **Dashboard** - God Mode overview: streak, readiness, volume, calories, habits, weekly chart
- **Workouts** - Professional workout hub with offline exercise library, routine templates, detailed routine builder, live session logging, RPE/tempo/rest tracking, warm-up helper, workout options, local history, guide caching, and animated stick-figure posture models
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

The web app does not use TypeScript, Tailwind, React, Vue, Angular, Next.js, or API calls for core app features. All core app data is stored locally in the browser using localStorage. The app can be opened from the HTML/CSS/JS files directly, with hash-based navigation for offline compatibility. The Google Fonts import improves typography when internet is available, while local system font fallbacks keep the app functional offline.

## Workout Tab Notes

The Workouts tab is implemented entirely in `artifacts/omni-fitness/app.js` and `artifacts/omni-fitness/styles.css`. Exercise guides include built-in offline metadata and can cache an offline guide entry. If the user has an OpenAI API key saved and is online, guide caching can enhance notes with AI-generated coaching text before saving locally.

## Legacy API Routes

The API artifact still contains the prior Express routes for workouts, nutrition, habits, recovery, analytics, and AI. The offline web app no longer depends on them for loading or core functionality.
