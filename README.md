# Goalixa PWA

![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?logo=pwa&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-Serving-009639?logo=nginx&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

Progressive Web Application for Goalixa productivity platform. Installable app with offline support.

## Features

| Feature | Description |
|---------|-------------|
| **Installable** | Add to home screen on any device |
| **Offline Support** | Core features work offline |
| **Service Worker** | Background sync and caching |
| **Push Ready** | Push notification infrastructure |
| **Fast** | Optimized loading with smart caching |

## Tech Stack

- **Vanilla JavaScript** - No framework overhead
- **Service Worker** - Offline and caching
- **Nginx** - Static file serving
- **Docker** - Containerization

## Project Structure

```
goalixa-pwa/
├── index.html           # App shell
├── sw.js                # Service worker
├── manifest.webmanifest # PWA manifest
├── js/
│   ├── router.js        # Client-side routing
│   ├── api.js           # API client
│   ├── auth.js          # Authentication
│   └── views/           # View components
├── css/                 # Stylesheets
├── assets/              # Images, icons
├── helm/                # Kubernetes deployment
└── Dockerfile
```

## Getting Started

### Development

```bash
# With npm
npm install
npm run serve

# With Docker
docker-compose up
```

Open http://localhost:8080

### Build

```bash
docker build -t goalixa-pwa:latest .
```

## Routes

### Authentication
| Route | Description |
|-------|-------------|
| `/login` | Login page |
| `/signup` | Registration |
| `/forgot-password` | Password reset request |
| `/reset-password` | Password reset form |

### Application
| Route | Description |
|-------|-------------|
| `/app` | Dashboard |
| `/app/tasks` | Task management |
| `/app/projects` | Projects |
| `/app/goals` | Goals |
| `/app/habits` | Habit tracking |
| `/app/timer` | Time tracking |
| `/app/calendar` | Calendar view |
| `/app/reports` | Reports |
| `/app/planner` | Weekly planner |
| `/app/reminders` | Reminders |
| `/app/labels` | Label management |
| `/app/account` | Account settings |

## Service Worker

### Cache Strategy

| Resource Type | Strategy |
|---------------|----------|
| Core Assets (HTML, CSS, JS) | Cache-First |
| Static Assets (images, fonts) | Cache-First (7 days) |
| API Requests | Network-First |
| Navigation | Network-First |

### Cache Invalidation

The service worker uses build hash for cache versioning:

1. New deployment creates new cache namespace
2. Browser detects new service worker
3. User sees "Update Available" prompt
4. Accepting update activates new version immediately
5. Old caches are automatically cleaned

## Configuration

The API client is configured in `js/api.js`:

```javascript
const config = {
  baseUrl: 'https://your-api-domain.com',
  authPrefix: '/auth',
  appPrefix: '/app'
};
```

## Deployment

### Docker

```bash
# Build with cache busting
docker build \
  --build-arg BUILD_HASH=$(git rev-parse HEAD) \
  --build-arg BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ") \
  -t goalixa-pwa:latest .
```

### Kubernetes

```bash
helm upgrade --install goalixa-pwa ./helm \
  --namespace goalixa \
  --create-namespace
```

## Troubleshooting

### Updates Not Showing

```javascript
// In browser console - force update
navigator.serviceWorker.getRegistrations().then(regs => {
  regs.forEach(r => r.unregister());
});
location.reload();
```

### Cache Issues

Check DevTools > Application > Cache Storage to inspect cached assets.

## PWA Testing

Test the update flow:

```javascript
window.testPWAUpdate && window.testPWAUpdate()
```

This clears caches and forces service worker re-registration.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Built by [Amirreza Rezaie](https://github.com/amirrezarezaie)
