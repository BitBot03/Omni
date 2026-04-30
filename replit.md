# Project OMNI - Fitness OS

## Overview
A pure HTML, CSS, and vanilla JavaScript fitness web application without any frameworks. Served by a tiny Node.js HTTP server.

## Stack
- Runtime: Node.js 20
- Server: Built-in `node:http` (in `omni-fitness/server.js`) with optional Express dependency at the root
- Frontend: Static HTML/CSS/JS in `omni-fitness/`
- No build step required

## Project Structure
- `omni-fitness/` — main application
  - `index.html` — entry HTML
  - `app.js`, `styles.css` — application bootstrap and styles
  - `js/` — application JS modules (config, store, UI, tabs)
  - `css/` — additional stylesheets
  - `public/` — static assets
  - `server.js` — minimal static file server, listens on `0.0.0.0:$PORT` (default 5000)
- `package.json` — root scripts (`npm run dev` / `npm start` run the server)

## Replit Setup
- Workflow `Start application` runs `npm run dev` on port 5000 (webview)
- Deployment target: `autoscale`, run command `npm start`
