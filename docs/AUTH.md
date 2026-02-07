# Authentication and Iframe Messaging

The PWA container manages auth state and shares it with the embedded app iframe.

**Auth storage**
- Cookie name: `goalixa_auth`
- LocalStorage fallback: `auth` key
- Auth state managed in `js/auth.js`

**Login flow**
1. Auth view submits credentials to Auth API.
2. Auth API returns a token.
3. Token is stored in the `goalixa_auth` cookie and localStorage.
4. Router redirects the user to `#/app` or the stored return path.

**Sharing auth with the iframe**
The app iframe receives the auth token through `postMessage`.
- Sender: PWA container
- Receiver: `https://app.goalixa.com`

Message payload format:
```json
{
  "type": "AUTH_TOKEN",
  "token": "<token>",
  "user": { "id": 1, "email": "user@example.com" }
}
```

**Iframe message types handled by the PWA**
- `REQUEST_AUTH` → PWA responds with `AUTH_TOKEN`.
- `AUTH_EXPIRED` → PWA attempts refresh.
- `LOGOUT` → PWA logs out and routes to `#/login`.
- `NAVIGATE` → PWA updates hash route.
- `RESIZE` → PWA resizes the iframe height.
- `COPY` → PWA copies text to clipboard and replies `COPY_SUCCESS`.

**Allowed origins**
Message handling allows:
- `https://app.goalixa.com`
- `https://auth.goalixa.com`
- The PWA origin (root domain)

**Backend requirements**
- Auth cookies should be set with `Domain=.goalixa.com` for cross-subdomain access.
- CORS should allow `https://goalixa.com` and `credentials: true`.

**Where to change auth behavior**
- Auth state: `js/auth.js`
- Auth UI: `js/views/auth-view.js`
- Iframe behavior: `js/views/app-view.js`
