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

## Workouts Progress Tab — Final Master Edition
Full-featured Progress subtab at `omni-fitness/js/tabs/workouts/progress.js` (IIFE, 1733 lines, 82KB):
- **Entry point**: `window.renderTabProgress(container)` — called by workouts.js router
- **CSS**: `omni-fitness/css/workouts-progress.css` (`.pg-*` namespace, linked in index.html)
- **Nav**: 4 tabs (Today, Routines, Exercises, Progress) — History tab removed; `history.js` redirects to Progress/Sessions

### Phase 0 — Cleanup
- History subtab removed from nav in `workouts.js`; `history.js` delegates to `renderTabProgress` with seg='sessions'

### Phase 1 — Pro UX
- **Deep links**: `pgSt_openLastSess`, `pgSt_openExFromOverview`, `pgSt_openExAndHighlightPR`, `pgSt_openSessFromEx`
- **SVG Chart Tooltips**: `pgShowTip(event, text)` / `pgHideTip()` — floating fixed-position tooltip on circle/rect hover
- **Favorites**: `omniPgFavs` in localStorage; ⭐ pin button on each exercise; "Pinned" filter chip

### Phase 2 — Intelligence
- **Delta badges** on Overview stat cards: computes previous period (same duration) and shows ▲/▼ with absolute + percentage
- **Trend tags**: linear regression slope over last 6 sessions → Up/Stable/Down color tag on exercise list items + detail header
- **PR Enrichment**: context line (e.g. "6 reps @ 100 kg"), delta vs prev best set, "NEW" badge for in-range PRs
- **Plateau detection**: ≥6 sessions with no improvement → ⚠ warning tag in exercise detail header

### Phase 3 — Workload & Structure
- **Workload panel**: avg sessions/sets/tonnage/time per week over selected range (via `weekBuckets`, `weekSetBuckets`, etc.)
- **Set Type Distribution**: stacked color bar (working/warmup/drop/failure) with percentage legend
- **Training Insights**: most-frequent session name, highest-volume session name

### Phase 4 — Sessions Polish
- **Custom confirm dialog**: `pgConfirm(msg, sub, label, onConfirm)` — replaces `window.confirm()` for delete actions
- **Undo toast**: `pgShowUndo(msg, undoFn)` — 5-second toast with Undo button after delete set/session
- **"Totals updated" banner**: shown in session detail after set edit/delete
- **"Repeat" button**: stores exercise list in `omniRepeatPlan` localStorage key, switches to Today tab
- **Clickable exercise names** in session detail → drill into Exercises tab

### Chart Utilities
- `lineChart(data, color, unit)` — smooth bezier + gradient fill SVG with interactive tooltips
- `barChart(data, color, unit)` — bar chart SVG with tooltips
- `sparkline(vals, w, h, color)` — inline polyline SVG for list items
- `barSparkline(data, color)` — HTML div bars for overview panels
- `drawHeatmap(sessions)` — 16-week HTML grid with day labels and month markers

### Key Global Handlers
`pgSetSeg`, `pgSetRange`, `pgSelectEx`, `pgSelectSess`, `pgSetSessView`, `pgToggleFav`, `pgToggleFavOnly`, `pgEditSetModal`, `pgSaveSet`, `pgDeleteSet`, `pgDeleteSession`, `pgRepeatSession`, `pgSt_openLastSess`, `pgSt_openExFromOverview`, `pgSt_openExAndHighlightPR`, `pgSt_openSessFromEx`, `pgShowTip`, `pgHideTip`

### State
`window.pgSt` — module state (seg, range, selExId, selSessId, sessView, exSearch, sessSearch, exFavOnly, sessions, allSets, library, prs, routines)

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
