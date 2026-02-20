# Goalixa PWA

Goalixa PWA is the frontend shell for authentication and the core app experience.
UI is rendered natively in PWA and data is served through `api.goalixa.com`.

## What this is
- Single installable PWA shell and service worker.
- Auth + App UI in one frontend.
- Backend services stay separate behind API gateway.

## Quick Start (Local)
```bash
npm install
npm run serve
# Open http://localhost:8080/login
```

## Main Routes
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/app`
- `/app/*` sections such as: `tasks`, `projects`, `reports`, `timer`, `calendar`, `goals`, `weekly-goals`, `habits`, `planner`, `reminders`, `labels`, `account`

## Endpoints
Configured in `js/api.js` with gateway base:
- `https://api.goalixa.com/auth/*`
- `https://api.goalixa.com/app/*`

## Key Files
- `index.html`
- `sw.js`
- `js/router.js`
- `js/api.js`
- `js/auth.js`
- `js/views/auth-view.js`
- `js/views/app-view.js`
