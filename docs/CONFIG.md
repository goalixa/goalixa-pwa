# Configuration

**API endpoints**
Defined in `js/api.js`:
- Landing API: `window.location.origin`
- Auth API: `https://auth.goalixa.com`
- App API: `https://app.goalixa.com`

If you change domains or add environments, update `API_CONFIG` in `js/api.js`.

**PWA Manifest**
- File: `manifest.webmanifest`
- Start URL: `/?source=pwa`
- Display: `standalone`
- Theme color: `#0f172a`
- Icons: `/icons/icon-*.png`

**Service Worker Scope**
- Registration in `index.html` uses scope `/`.
- Keep the service worker at the root to control all routes.

**Static hosting requirements**
- Serve `index.html` for `/`.
- Serve all static assets under `/css`, `/js`, `/icons`.
- Allow hash routes to be handled client-side.

**Auth cookie**
- Cookie name: `goalixa_auth`.
- Set `Domain=.goalixa.com` so it works across subdomains.
