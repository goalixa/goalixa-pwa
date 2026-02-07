# Deployment

This PWA is static content and can be served by any web server or CDN. A Docker + nginx setup is included.

**Local development**
```bash
cd /Users/snapp/Desktop/projects/Goalixa/goalixa-pwa
npm install
npm run serve
```

**Docker**
```bash
docker build -t goalixa-pwa:latest .
docker run --rm -p 8080:8080 goalixa-pwa:latest
```

**Nginx**
The repo includes `nginx.conf` for static hosting and SPA routing.
- Serves `index.html` for all routes.
- Disables caching for `sw.js`.
- Long cache for static assets.

If you want to proxy API calls through this server, add routes that match your API paths in `js/api.js`. The current `nginx.conf` contains example proxy blocks for `/api/landing/` and `/api/auth/`.

**Recommended production setup**
- PWA at `https://goalixa.com/`
- Landing API at `https://goalixa.com/api/*`
- Auth at `https://auth.goalixa.com/`
- App at `https://app.goalixa.com/`

**TLS**
PWA features and service workers require HTTPS in production.

**CORS and cookies**
- Allow origin: `https://goalixa.com`
- Allow credentials: `true`
- Set auth cookies with `Domain=.goalixa.com`
