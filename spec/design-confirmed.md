# Architecture Design: WorkOS SSO PoC

## System Architecture

```
  Browser (on Site A or Site B)
    │
    ├─(A) GET <FRONTEND_URL_A>/           ──► Frontend Server A   (port 3000 / domain-a.com)
    │   or GET <FRONTEND_URL_B>/          ──► Frontend Server B   (port 3002 / domain-b.com)
    │                                          each serves its own index.html + env.js
    │
    ├─(B) fetch <BFF_URL>/auth/session    ──► BFF Server          (port 3001 / api.example.com)
    │◄─── { authenticated, user }  ◄──────────  (shared — same session cookie on same BFF origin)
    │
    ├─(C) navigate <BFF_URL>/auth/login?returnTo=<FRONTEND_URL_A>
    │                                     ──► BFF Server
    │◄─── 302 → WorkOS authorization URL ◄────  (returnTo stored in session)
    │
    ├─(D) browser → WorkOS / Google login
    │
    ├─(E) GET <BFF_URL>/auth/callback     ──► BFF Server
    │         (WorkOS redirect)                exchanges code+verifier, reads returnTo from session
    │◄─── 302 → <returnTo>/profile.html   ◄───  (redirects back to originating site)
    │
    ├─(H) GET <FRONTEND_URL_A>/profile.html ──► Frontend Server A
    │
    ├─(I) fetch <BFF_URL>/auth/session    ──► BFF Server
    │◄─── { authenticated: true, user }  ◄────
    │      (page renders name + email)
    │
    ├─(K) GET <FRONTEND_URL_B>/           ──► Frontend Server B   (different site, same session)
    │
    ├─(L) fetch <BFF_URL>/auth/session    ──► BFF Server
    │◄─── { authenticated: true, user }  ◄────  (shared session — already signed in)
    │
    └─(J) navigate <BFF_URL>/auth/logout?returnTo=<FRONTEND_URL_A>
                                          ──► BFF Server
          ◄─── 302 → <returnTo>/  ◄────────    (returns to originating site)
```

## Tech Stack

| Category      | Choice                  | Rationale                                                          |
|---------------|-------------------------|--------------------------------------------------------------------|
| Runtime       | Node.js 20 LTS          | Stable, wide ecosystem, matches Express requirement                |
| Frontend srv  | Express 4               | Lightweight static file server; also serves dynamic `env.js`      |
| BFF framework | Express 4               | Required by spec; minimal boilerplate for auth routes             |
| WorkOS SDK    | @workos-inc/node        | Required by spec; provides SSO client, PKCE class, profile types  |
| Session store | express-session (memory)| In-memory only per spec; no database required for PoC             |
| CORS          | cors (npm)              | Handles `Access-Control-Allow-Origin` + credentials headers cleanly|
| Config        | shared/config.js        | Single module deriving all env-dependent values from `APP_ENV`    |
| Process mgmt  | concurrently            | Starts both servers with a single `npm start`                     |
| Testing       | Jest + Supertest        | Jest is the standard Node test runner; Supertest enables HTTP route testing without a live server |

## Component Design

### Component Hierarchy

```
workos-sso-poc/
├── shared/
│   └── config.js          # APP_ENV-driven config (URLs, cookie flags)
├── frontend/
│   ├── server.js           # express.static + GET /env.js route
│   └── public/
│       ├── index.html      # login page
│       └── profile.html    # profile page
├── bff/
│   ├── server.js           # Express app: session, cors, auth router
│   └── routes/
│       └── auth.js         # /auth/session /auth/login /auth/callback /auth/logout
└── tests/
    ├── bff.test.js
    ├── auth.session.test.js
    ├── auth.login.test.js
    ├── auth.callback.test.js
    └── auth.logout.test.js
```

### Key Data Models

```js
// shared/config.js — shape
config = {
  appEnv:       'local' | 'production',
  frontendUrls: string[],  // e.g. ['http://localhost:3000','http://localhost:3002'] or ['https://app1.example.com','https://app2.example.com']
  bffUrl:       string,    // e.g. 'http://localhost:3001' or 'https://api.example.com'
  cookie: {
    secure:   boolean,     // false in local, true in production
    sameSite: 'lax' | 'none',
    name:     'sid' | '__Host-sid',
  }
}

// Session shape (stored server-side in express-session)
session = {
  codeVerifier: string | undefined,   // set in /auth/login, cleared in /auth/callback
  returnTo:     string | undefined,   // validated frontend origin, set in /auth/login, cleared in /auth/callback
  user: {
    firstName: string,
    lastName:  string,
    email:     string,
  } | undefined
}

// GET /auth/session response
{ authenticated: false }
// or
{ authenticated: true, user: { firstName, lastName, email } }
```

### Runtime config injection (`/env.js`)

Static HTML cannot read Node env vars directly. Each frontend server exposes a dynamic
`GET /env.js` route that writes `window.__APP_CONFIG__` so inline scripts can resolve
`BFF_URL` and the site's own `FRONTEND_URL` without hardcoding:

```js
// frontend/server.js — dynamic route (before express.static)
app.get('/env.js', (req, res) => {
  res.type('application/javascript')
  res.send(`window.__APP_CONFIG__ = ${JSON.stringify({ bffUrl: config.bffUrl, frontendUrl: config.frontendUrl })};`)
})
```

```html
<!-- index.html and profile.html -->
<script src="/env.js"></script>
<script>
  const BFF_URL = window.__APP_CONFIG__.bffUrl
  const FRONTEND_URL = window.__APP_CONFIG__.frontendUrl
  // Login button: window.location.href = BFF_URL + '/auth/login?returnTo=' + FRONTEND_URL
  // Logout link:  BFF_URL + '/auth/logout?returnTo=' + FRONTEND_URL
</script>
```

Each frontend server reads its own `FRONTEND_URL` env var (defaults to `http://localhost:3000`
for Site A, `http://localhost:3002` for Site B) and injects it into `env.js` so the pages
can pass the correct `returnTo` value without any hardcoding.

## Data Flow

### Login (US-2 → US-3)

```mermaid
sequenceDiagram
    participant B as Browser (on Site A)
    participant F as Frontend A
    participant BFF as BFF
    participant W as WorkOS / Google

    B->>F: GET /
    F-->>B: index.html + /env.js (sets window.__APP_CONFIG__ with bffUrl + frontendUrl)

    B->>BFF: fetch GET /auth/session (credentials: include)
    BFF-->>B: { authenticated: false }
    note over B: show Sign in button

    B->>BFF: navigate GET /auth/login?returnTo=http://localhost:3000
    note over BFF: validate returnTo against FRONTEND_URLS allowlist<br/>generate codeVerifier/codeChallenge<br/>store codeVerifier + returnTo in session
    BFF-->>B: 302 → WorkOS authorization URL

    B->>W: GET /authorize?code_challenge=...
    W-->>B: Google login page
    note over B: user authenticates

    B->>BFF: GET /auth/callback?code=X
    note over BFF: retrieve codeVerifier + returnTo from session
    BFF->>W: exchange code + codeVerifier
    W-->>BFF: user profile
    note over BFF: store user in session<br/>clear codeVerifier + returnTo
    BFF-->>B: 302 → <returnTo>/profile.html  (back to Site A)
```

## UI Wireframes

### index.html — Login Page
```
┌─────────────────────────────────┐
│                                 │
│        Welcome                  │
│                                 │
│   [ Sign in with Google ]       │
│                                 │
└─────────────────────────────────┘
```

### profile.html — Authenticated Page
```
┌─────────────────────────────────┐
│                                 │
│   You're logged in!             │
│                                 │
│   Name:   Jane Doe              │
│   Email:  jane@example.com      │
│                                 │
│   [ Sign out ]                  │
│                                 │
└─────────────────────────────────┘
```

## File Structure

```
workos-sso-poc/
├── package.json                   # root scripts: start, test
├── .env.example                   # documents both local and production vars
├── .gitignore
│
├── shared/
│   └── config.js                  # APP_ENV → { frontendUrl, bffUrl, cookie }
│
├── frontend/
│   ├── server.js                  # GET /env.js + express.static('./public'), port 3000
│   └── public/
│       ├── index.html             # login page (includes /env.js, inline <script>)
│       └── profile.html          # profile page (includes /env.js, inline <script>)
│
├── bff/
│   ├── server.js                  # express app: session, cors, mounts auth router, port 3001
│   └── routes/
│       └── auth.js                # /auth/session, /auth/login, /auth/callback, /auth/logout
│
└── tests/
    ├── bff.test.js                # CORS + session middleware
    ├── auth.session.test.js       # /auth/session
    ├── auth.login.test.js         # /auth/login
    ├── auth.callback.test.js      # /auth/callback
    └── auth.logout.test.js        # /auth/logout
```

## Summary

**Key decisions:**

- **`APP_ENV` flag in `shared/config.js`** — a single module reads `APP_ENV`, `FRONTEND_URLS` (comma-separated), and `BFF_URL` from the environment and exports a `config` object consumed by both servers. This keeps all environment branching in one place.

- **`FRONTEND_URLS` allowlist** — replaces the single `FRONTEND_URL`. All frontend origins are stored as an array. CORS, `returnTo` validation, and logout fallback all operate against this list. Adding a new site only requires adding its origin to the env var.

- **`returnTo` query param on `/auth/login` and `/auth/logout`** — each frontend passes its own origin as `returnTo`. The BFF validates it against the allowlist before storing in session (login) or using in the redirect (logout). This allows multiple sites to share the BFF while each user lands back on the site they started from. Strict allowlist matching prevents open-redirect attacks.

- **`frontendUrl` injected into `/env.js`** — each frontend server reads its own `FRONTEND_URL` env var and includes it in `window.__APP_CONFIG__` alongside `bffUrl`. Pages use this to construct the `returnTo` value without hardcoding.

- **Session cookie tied to the BFF origin** — because all frontends `fetch` the same BFF with `credentials: 'include'`, the browser sends the same session cookie to the BFF regardless of which frontend initiated the request. Sign-in on Site A is automatically recognised on Site B with no extra token exchange.

- **Cookie flags driven by `APP_ENV`** — `local` uses `sameSite: 'lax'` + `secure: false` (HTTP-friendly); `production` uses `sameSite: 'none'` + `secure: true` (required for cross-origin cookies over HTTPS).

- **Two separate Express processes** — mirrors the RFC §6.1 diagram; `concurrently` starts both from a single `npm start`.

- **CORS origin as a function** — checks the request `Origin` header against the `frontendUrls` array dynamically; never a wildcard; satisfies CSRF defense (§6.1.3.3) in both environments.

- **Memory session store** — acceptable for PoC; not suitable for multi-instance production deployment.

- **Jest + Supertest** — BFF Express app is imported directly; no live port needed in tests.
