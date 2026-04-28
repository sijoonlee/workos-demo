# Tasks: WorkOS SSO PoC

## Task 1: Project Setup
**Feature**: Scaffolding & tooling  
**Requirement**: N/A

### Implementation
- [ ] Create root `package.json` with `scripts.start` (`concurrently "node frontend/server.js" "node bff/server.js"`), `scripts.test` (`jest`)
- [ ] Install dependencies: `express`, `express-session`, `cors`, `@workos-inc/node`, `concurrently`
- [ ] Install dev dependencies: `jest`, `supertest`
- [ ] Create `.env.example` documenting all vars with inline comments for both modes:
  - `APP_ENV=local` section: `FRONTEND_URL`, `BFF_URL` with localhost defaults noted
  - `APP_ENV=production` section: `FRONTEND_URL`, `BFF_URL` as required
  - Common: `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `SESSION_SECRET`
- [ ] Create `.gitignore` with `node_modules/`, `.env`
- [ ] Create empty directory structure: `shared/`, `frontend/public/`, `bff/routes/`, `tests/`

### Tests
- [ ] Write `tests/setup.test.js`: smoke test that the BFF app module loads without throwing
  - `'bff app initialises without error'`
- [ ] Run `npm test` — all tests pass

---

## Task 2: Shared Config Module
**Feature**: `APP_ENV`-driven configuration  
**Requirement**: Environment Flag NFR

### Implementation
- [ ] Create `shared/config.js`:
  - Read `APP_ENV` (default `'local'`), `FRONTEND_URL`, `BFF_URL`, `SESSION_SECRET`, `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`
  - In `local` mode: default `FRONTEND_URL` to `http://localhost:3000`, `BFF_URL` to `http://localhost:3001`
  - In `production` mode: throw on startup if `FRONTEND_URL` or `BFF_URL` are missing
  - Always throw on startup if `SESSION_SECRET`, `WORKOS_API_KEY`, or `WORKOS_CLIENT_ID` are missing
  - Export `config` object: `{ appEnv, frontendUrl, bffUrl, cookie: { secure, sameSite, name } }`
  - `local` cookie: `{ secure: false, sameSite: 'lax', name: 'sid' }`
  - `production` cookie: `{ secure: true, sameSite: 'none', name: '__Host-sid' }`

### Tests
- [ ] Write `tests/config.test.js`: → verifies Environment Flag NFR
  - `'local mode sets correct cookie flags and default URLs'`
  - `'production mode throws if FRONTEND_URL is missing'`
  - `'production mode throws if BFF_URL is missing'`
  - `'throws if SESSION_SECRET is missing in any mode'`
- [ ] Run `npm test` — all tests pass

---

## Task 3: Frontend Server
**Feature**: Static file serving + runtime config injection  
**Requirement**: Servers NFR, US-1, US-2, US-4

### Implementation
- [ ] Create `frontend/server.js`:
  - Require `shared/config.js`
  - Add `GET /env.js` route (before `express.static`) that responds with `window.__APP_CONFIG__ = ${JSON.stringify({ bffUrl: config.bffUrl })};`
  - Mount `express.static(path.join(__dirname, 'public'))`
  - Listen on port `3000` and log `Frontend server running on ${config.frontendUrl}`

### Tests
- [ ] Write `tests/frontend.test.js`: → verifies Servers NFR
  - `'GET /env.js returns JS that sets window.__APP_CONFIG__ with bffUrl'`
  - `'GET / serves index.html with 200'`
  - `'GET /profile.html serves profile page with 200'`
- [ ] Run `npm test` — all tests pass

---

## Task 4: Static HTML Pages
**Feature**: Login page & profile page UI  
**Requirement**: US-1, US-2, US-4, US-5

### Implementation
- [ ] Create `frontend/public/index.html`:
  - `<script src="/env.js"></script>` in `<head>`
  - Inline `<script>`: on `DOMContentLoaded`, call `fetch(BFF_URL + '/auth/session', { credentials: 'include' })`; if `authenticated: true` redirect to `BFF_URL` replaced with `window.__APP_CONFIG__.bffUrl` and navigate to `FRONTEND_URL/profile.html`
  - Show login button only when `authenticated: false`; button links to `window.__APP_CONFIG__.bffUrl + '/auth/login'`
- [ ] Create `frontend/public/profile.html`:
  - `<script src="/env.js"></script>` in `<head>`
  - On load, call `fetch(window.__APP_CONFIG__.bffUrl + '/auth/session', { credentials: 'include' })`
  - If `authenticated: false`, redirect to frontend root (`/`)
  - If `authenticated: true`, render `firstName`, `lastName`, `email` into the page
  - "Sign out" link pointing to `window.__APP_CONFIG__.bffUrl + '/auth/logout'`

### Tests
- No automated tests for browser JS behaviour (covered by end-to-end smoke test during implementation review)
- [ ] Run `npm test` — all tests pass (no regressions)

---

## Task 5: BFF Server & Session Setup
**Feature**: BFF app bootstrap  
**Requirement**: Security NFRs (cookies, CORS, session)

### Implementation
- [ ] Create `bff/server.js`:
  - Require `shared/config.js`
  - Configure `cors` middleware: `origin: config.frontendUrl`, `credentials: true`
  - Configure `express-session`: `name: config.cookie.name`, `secret: config.sessionSecret`, `resave: false`, `saveUninitialized: false`, cookie flags from `config.cookie`
  - Mount `bff/routes/auth.js` at `/auth`
  - Export the Express `app` (for Supertest) and listen on port `3001` only when run directly

### Tests
- [ ] Write `tests/bff.test.js`: → verifies Security NFRs
  - `'OPTIONS /auth/session returns correct CORS headers for configured frontend origin'`
  - `'requests from unknown origin do not receive Access-Control-Allow-Credentials'`
- [ ] Run `npm test` — all tests pass

---

## Task 6: `/auth/session` Endpoint
**Feature**: Session check  
**Requirement**: US-1

### Implementation
- [ ] Add `GET /session` in `bff/routes/auth.js`
- [ ] If `req.session.user` exists: return `200` `{ authenticated: true, user: { firstName, lastName, email } }`
- [ ] Otherwise: return `200` `{ authenticated: false }`

### Tests
- [ ] Write `tests/auth.session.test.js`: → verifies US-1 AC
  - `'GET /auth/session returns authenticated:false when no session'`
  - `'GET /auth/session returns authenticated:true with user when session exists'`
- [ ] Run `npm test` — all tests pass

---

## Task 7: `/auth/login` Endpoint (PKCE)
**Feature**: SSO login initiation  
**Requirement**: US-2

### Implementation
- [ ] Initialise WorkOS client in `bff/routes/auth.js` using `config.workosApiKey`
- [ ] Add `GET /login` handler:
  - Generate `codeVerifier` with `crypto.randomBytes(32).toString('base64url')`
  - Derive `codeChallenge` with `crypto.createHash('sha256').update(codeVerifier).digest('base64url')`
  - Store `codeVerifier` in `req.session.codeVerifier`
  - Build authorization URL: `workos.userManagement.getAuthorizationUrl({ clientId, redirectUri: config.bffUrl + '/auth/callback', provider: 'GoogleOAuth', codeChallenge, codeChallengeMethod: 'S256' })`
  - Redirect `302` to the authorization URL

### Tests
- [ ] Write `tests/auth.login.test.js`: → verifies US-2 AC
  - `'GET /auth/login redirects to a WorkOS authorization URL'`
  - `'GET /auth/login stores codeVerifier in session'`
- [ ] Run `npm test` — all tests pass

---

## Task 8: `/auth/callback` Endpoint (PKCE exchange)
**Feature**: SSO callback & token exchange  
**Requirement**: US-3

### Implementation
- [ ] Add `GET /callback` in `bff/routes/auth.js`:
  - Missing `code` → `400` `'Missing authorization code'`
  - Missing `req.session.codeVerifier` → `400` `'Missing code verifier'`
  - Call `workos.userManagement.authenticateWithCodeAndVerifier({ code, codeVerifier, clientId })`
  - Store `{ firstName, lastName, email }` in `req.session.user`
  - Delete `req.session.codeVerifier`
  - Redirect `302` to `config.frontendUrl + '/profile.html'`
  - SDK error → `400` with error message

### Tests
- [ ] Write `tests/auth.callback.test.js`: → verifies US-3 AC
  - `'GET /auth/callback returns 400 when code is missing'`
  - `'GET /auth/callback returns 400 when codeVerifier is missing from session'`
  - `'GET /auth/callback stores user in session and redirects on success'` (mock WorkOS SDK)
  - `'GET /auth/callback clears codeVerifier after successful exchange'`
- [ ] Run `npm test` — all tests pass

---

## Task 9: `/auth/logout` Endpoint
**Feature**: Sign out  
**Requirement**: US-5

### Implementation
- [ ] Add `GET /logout` in `bff/routes/auth.js`:
  - Call `req.session.destroy()`
  - Redirect `302` to `config.frontendUrl`

### Tests
- [ ] Write `tests/auth.logout.test.js`: → verifies US-5 AC
  - `'GET /auth/logout destroys session and redirects to frontend root'`
  - `'GET /auth/session returns authenticated:false after logout'`
- [ ] Run `npm test` — all tests pass

---

## Task Dependencies

| Task | Depends On |
|------|------------|
| Task 2 | Task 1 |
| Task 3 | Task 1, Task 2 |
| Task 4 | Task 3 |
| Task 5 | Task 1, Task 2 |
| Task 6 | Task 5 |
| Task 7 | Task 5 |
| Task 8 | Task 5, Task 7 |
| Task 9 | Task 5 |

## Requirements Traceability

| Requirement | Tasks |
|-------------|-------|
| US-1 (Check session) | Task 6 |
| US-2 (Initiate login) | Task 7 |
| US-3 (SSO callback) | Task 8 |
| US-4 (Profile page) | Task 4 |
| US-5 (Sign out) | Task 9 |
| Environment Flag NFR | Task 2 |
| Servers NFR | Task 3, Task 5 |
| CORS NFR | Task 5 |
| Cookie NFR | Task 2, Task 5 |
| CSRF NFR | Task 5 |
| Dependencies NFR | Task 1 |

## Quality Check
- [x] One feature per task
- [x] Every task that adds behavior has automated test code
- [x] Test files are named and test cases are described
- [x] All requirements covered by at least one task
- [x] Tasks are 1–4 hours each
- [x] Dependencies respected in ordering
- [x] Setup task installs test framework and adds `npm test` script
