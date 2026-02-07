# Routing

Routing is hash-based so the PWA can be served as static files with no server-side route rewrites.

**Route format**
- `https://goalixa.com/#/landing`
- `https://goalixa.com/#/login`
- `https://goalixa.com/#/app/projects`

**Static routes**
- `#/` and `#/landing` → Landing view
- `#/auth`, `#/login`, `#/signup`, `#/register` → Auth view
- `#/forgot-password`, `#/reset-password` → Auth view
- `#/app` → App view
- `#/app/*` → App view

**Auth gating**
Routes under `/app` require auth. If a user is not authenticated:
- The router stores the requested path in `sessionStorage` as `redirectAfterLogin`.
- The router navigates to `#/login`.
- After login, the user is redirected to the original path.

**Dynamic routes**
The router treats anything that starts with `/app/` as a valid route and renders the App view.

**Where to change routes**
- `js/router.js` defines the route table and auth-required routes.
