# Goalixa PWA Repository

## Purpose
Unified Progressive Web App container that wraps Landing, Auth, and App services via iframes while keeping them independently deployable.

## Architecture
- **Single installable PWA**: Unified service worker and manifest
- **Iframe-based integration**: Wraps three independent backend services
- **Hash-based routing**: Client-side router with auth protection
- **Cross-frame communication**: PostMessage API for iframe communication
- **External route handling**: Redirects auth routes to canonical auth UI

## Tech Stack
- **Vanilla JavaScript** (ES6+ modules)
- **Service Worker** for offline capability
- **PostMessage API** for iframe communication
- **Event Bus** for pub/sub messaging
- **No frameworks** - pure browser APIs

## Key Features
- Installable as desktop/mobile app
- Unified routing across all views
- Authentication state management
- Auto token refresh
- Cross-domain cookie handling
- Demo tour support

## File Structure
```
goalixa-pwa/
├── index.html
├── manifest.webmanifest   # PWA manifest
├── sw.js                  # Service worker
├── js/
│   ├── router.js          # Hash-based router
│   ├── auth.js            # Authentication state
│   ├── api.js             # API client
│   ├── utils.js           # Utilities and event bus
│   └── views/
│       ├── landing-view.js
│       ├── auth-view.js
│       ├── app-view.js
│       └── demo-view.js
└── css/
    └── style.css
```

## Code Conventions
- ES6 modules with import/export
- Async/await for all async operations
- Event bus pattern: `eventBus.emit(event, data)` / `eventBus.on(event, handler)`
- Route configuration object with view modules
- `navigate(path)` function for navigation
- `isAuthenticated()` for auth state
- Auto-redirect to auth service for login/register

## Route Configuration
```javascript
const routes = {
  '/': { view: 'landing', title: 'Goalixa - Goals, Plans, Projects, Tasks' },
  '/app': { view: 'app', title: 'Goalixa - App', auth: true },
  '/login': { view: 'auth', title: 'Goalixa - Login' },
  // etc.
}
```

## External Routes
Auth routes redirect to canonical auth UI:
- `/login`, `/auth` → `https://auth.goalixa.com/login`
- `/register`, `/signup` → `https://auth.goalixa.com/register`
- `/forgot-password` → `https://auth.goalixa.com/forgot`

## Service Worker
- Caches offline assets
- Provides installability
- Handles offline fallback

## Event Bus Events
- `navigate`: Trigger navigation to path
- `auth:login`: User logged in
- `auth:logout`: User logged out
- Custom view-specific events
