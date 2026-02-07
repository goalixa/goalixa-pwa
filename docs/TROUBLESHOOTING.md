# Troubleshooting

**PWA does not install**
- Verify HTTPS in production.
- Confirm `manifest.webmanifest` is reachable and valid JSON.
- Confirm service worker is registered without errors in DevTools.

**Routes show a blank page**
- Ensure `index.html` is served for all routes.
- If using nginx, confirm `try_files $uri $uri/ /index.html;` is present.
- Use hash routes like `#/app` to avoid server rewrites.

**Auth does not persist across subdomains**
- Set auth cookie with `Domain=.goalixa.com`.
- Enable `SameSite=None; Secure` if using cross-site cookies.
- Ensure CORS allows `https://goalixa.com` with credentials.

**Iframe does not load App**
- Check `https://app.goalixa.com` is reachable.
- Ensure the app allows embedding. Remove or adjust `X-Frame-Options` and `Content-Security-Policy` if blocking.

**CORS errors in console**
- Add `Access-Control-Allow-Origin: https://goalixa.com`.
- Add `Access-Control-Allow-Credentials: true`.
- Ensure preflight `OPTIONS` requests succeed.

**Service worker serving stale assets**
- Bump `CACHE_VERSION` in `sw.js`.
- Clear site data in DevTools.
- Reload with “Update on reload” in Application → Service Workers.

**Offline page does not appear**
- Confirm `/offline.html` is cached by the service worker.
- Open the app once online so it can cache assets.
