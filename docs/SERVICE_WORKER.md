# Service Worker

The service worker provides offline support and caching for the unified PWA.

**Cache buckets**
- Core: base HTML and JS modules.
- Assets: icons and external CSS/fonts.
- API: network-first caching for API responses.
- Pages: navigation responses cached for offline fallback.

**Strategies**
- Network-first for API requests and page navigations.
- Cache-first for static assets.
- Offline fallback to `/offline.html` when navigation fails.

**Core assets precached**
- `index.html`, `offline.html`, `manifest.webmanifest`
- `css/styles.css`
- All JS modules in `/js` and `/js/views`

**External assets precached**
- Font Awesome CSS
- Google Fonts CSS

**Update flow**
- New versions use `CACHE_VERSION` in `sw.js`.
- When the version changes, old caches are deleted in `activate`.
- `index.html` shows a toast when a new worker is installed.

**Where to change behavior**
- `sw.js`
