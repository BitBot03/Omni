# Project OMNI - Fitness OS

## Overview
A comprehensive fitness tracking dashboard built as a Single Page Application (SPA) with vanilla JavaScript, HTML, and CSS. Features include workout tracking, nutrition logging, recovery monitoring, analytics, and an AI Coach.

## Architecture
- **Frontend**: Vanilla JS, HTML5, CSS3 — no build step required
- **Server**: Node.js using the native `http` module (`omni-fitness/server.js`) serving static files
- **Routing**: Hash-based client-side routing (e.g., `#workouts`, `#nutrition`)

## Project Structure
```
/
├── package.json          # npm scripts: dev/start → node omni-fitness/server.js
├── omni-fitness/
│   ├── index.html        # App entry point
│   ├── app.js            # Main app logic & router
│   ├── server.js         # Node.js static file server (port 5000, 0.0.0.0)
│   ├── styles.css        # Global styles
│   ├── css/              # Component-specific stylesheets
│   ├── js/               # Core JS modules
│   │   ├── db.js, store.js, data.js   # Data management
│   │   ├── ui.js, icons.js, config.js # UI utilities
│   │   └── tabs/                       # Section-specific logic
│   │       ├── dashboard.js, nutrition.js, recovery.js
│   │       ├── analytics.js, ai.js, settings.js
│   │       └── workouts/               # Workout sub-modules
│   └── public/           # Static assets (favicon, og image)
└── app/                  # Legacy/applet directory
```

## Workouts Progress Tab
Full-featured Progress subtab at `omni-fitness/js/tabs/workouts/progress.js` (IIFE module):
- **Entry point**: `window.renderTabProgress(container)` — called by workouts.js router
- **CSS**: `omni-fitness/css/workouts-progress.css` (`.pg-*` namespace, linked in index.html)
- **Segments**: Overview · Exercises · Records (PRs) · Sessions — segmented control + date range filter (7d/30d/90d/YTD/All)
- **Overview**: 6 stat cards, 16-week consistency heatmap, weekly session/volume bar sparklines, quick actions, recent PRs panel
- **Exercises**: Left list (search, sparklines, session count) + right detail with SVG line/bar charts per tracking type (weight_reps: e1RM/top-weight/volume; bodyweight: reps; time; distance), all-time best sets table, sessions list
- **Records**: PRs grouped by tracking type (weight+reps, bodyweight, timed, cardio) with auto-update on set edit
- **Sessions**: List view (search) + calendar view (current month); right panel shows full exercise/set breakdown with inline edit & delete buttons
- **Edit flow**: Edit set modal → save → recompute session totals → recompute PRs → refresh detail panel → emit `workoutUpdated`
- **SVG charts**: `lineChart()` (smooth bezier + gradient fill), `barChart()`, `sparkline()` (polyline), `barSparkline()` (HTML divs), `drawHeatmap()` (HTML grid)
- **Global handlers**: `pgSetSeg`, `pgSetRange`, `pgSelectEx`, `pgSelectSess`, `pgSetSessView`, `pgEditSetModal`, `pgSaveSet`, `pgDeleteSet`, `pgDeleteSession`, `pgSt_openLastSess`, `pgSt_openExFromOverview`

## Workouts Today Tab — Runner Logic
The workout runner (`omni-fitness/js/tabs/workouts/today-runner.js`) was fully fixed:
- **Stable `stepId`** per step (`{sessionId}|{blockId}|{exId}|SET|set:{i}|round:{r}`) — never changes during session
- **Immutable queue** built once at session start; rebuilt only on exercise add/remove, preserving cursor by stepId
- **Single cursor authority**: only `advance(cause)` moves the cursor; protected by `_advancing` re-entrancy guard
- **Next button debounced** 200ms to prevent double-tap races
- **Per-step timer-end guard** (`_endedStepIds` Set) — `_onCountdownDone` fires exactly once per step
- **`next()` fixed**: no longer sets `phase = COMPLETE` before calling `wkAutoLogSet`; uses `AWAIT_LOG` transitional state and `_wasRunningBeforeLog` flag to correctly restore running state after async log
- **`_syncStepsToLogs`**: tracks completedStepIds to prevent double-advance; passes `keepRunning` flag to `advance()`
- **`today.js`**: set rows now carry `data-step-id` for precise CSS class sync

## Running the App
```bash
npm run dev   # or npm start
```
Serves on `http://0.0.0.0:5000`

## Workflow
- **Start application**: `npm run dev` — web preview on port 5000

## Deployment
- Target: autoscale
- Run: `node omni-fitness/server.js`
