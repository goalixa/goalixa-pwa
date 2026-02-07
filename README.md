# Goalixa PWA (Unified Container)

A single installable PWA that wraps the Landing, Auth, and App experiences under one container, while keeping the backend as three independent microservices.

**What this is**
- One PWA shell, one manifest, one service worker.
- Three backend services remain separate and are still accessible by browser directly.
- The main App is embedded via `iframe` and communicates with the PWA shell via `postMessage`.

**What this is not**
- This is not a monolith. Backends stay split.
- This is not a framework app. It is vanilla JS and static hosting.

**Quick Start (Local)**
```bash
cd /Users/snapp/Desktop/projects/Goalixa/goalixa-pwa
npm install
npm run serve
# Open http://localhost:8080/#/landing
```

**Routes (Hash-Based)**
- `#/` or `#/landing`
- `#/login`, `#/signup`, `#/forgot-password`
- `#/app` and anything under `#/app/*`

**Service Endpoints**
Configured in `js/api.js`.
- Landing API: `window.location.origin` (same domain as the PWA)
- Auth API: `https://auth.goalixa.com`
- App API: `https://app.goalixa.com`

**Key Files**
- `index.html` entry point and service worker registration
- `manifest.webmanifest` single PWA manifest
- `sw.js` unified service worker
- `js/router.js` hash router
- `js/auth.js` auth state manager
- `js/api.js` API client for all services
- `js/views/landing-view.js` landing UI
- `js/views/auth-view.js` login/signup UI
- `js/views/app-view.js` app iframe container

**Directory Structure**
```text
goalixa-pwa/
├── css/
│   └── styles.css
├── docs/
│   ├── ARCHITECTURE.md
│   ├── AUTH.md
│   ├── CONFIG.md
│   ├── DEPLOYMENT.md
│   ├── ROUTING.md
│   ├── SERVICE_WORKER.md
│   └── TROUBLESHOOTING.md
├── icons/
├── js/
│   ├── api.js
│   ├── auth.js
│   ├── router.js
│   ├── utils.js
│   └── views/
│       ├── app-view.js
│       ├── auth-view.js
│       └── landing-view.js
├── index.html
├── manifest.webmanifest
├── offline.html
├── sw.js
├── nginx.conf
├── Dockerfile
└── package.json
```

**Documentation**
- Architecture: `docs/ARCHITECTURE.md`
- Routing: `docs/ROUTING.md`
- Auth and iframe messaging: `docs/AUTH.md`
- Service worker caching: `docs/SERVICE_WORKER.md`
- Configuration and endpoints: `docs/CONFIG.md`
- Deployment and nginx: `docs/DEPLOYMENT.md`
- Troubleshooting: `docs/TROUBLESHOOTING.md`
