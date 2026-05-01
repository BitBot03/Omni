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
