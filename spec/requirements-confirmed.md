# Requirements: WorkOS SSO PoC

## Overview

A proof-of-concept application consisting of two separate Express servers following the OAuth 2.0 BFF pattern (draft-ietf-oauth-browser-based-apps §6.1): a **frontend server** that serves static HTML pages, and a **BFF server** that acts as a confidential OAuth client handling all session and auth logic. The BFF integrates with WorkOS SSO via Google using PKCE. The frontend checks session state on load via a dedicated BFF endpoint and adapts its UI accordingly. After a successful login, the user sees a profile page confirming their identity.

An `APP_ENV` flag switches all environment-dependent behaviour (URLs, cookie security, CORS) between `local` and `production` modes without code changes.

## User Stories

### US-1: Check Session on Page Load
**As a** visitor on the static HTML page  
**I want** the page to check my session status automatically on load  
**So that** I am shown the correct UI (login button vs. authenticated state) without a manual page transition

#### Acceptance Criteria
- [ ] On page load, the frontend calls `GET <BFF_URL>/auth/session` via `fetch` with `credentials: 'include'`
- [ ] If the session is active, `GET /auth/session` returns `200` with `{ authenticated: true, user: { firstName, lastName, email } }`
- [ ] If no session is active, `GET /auth/session` returns `200` with `{ authenticated: false }`
- [ ] The frontend shows the "Sign in with Google" button only when `authenticated` is `false`
- [ ] The frontend redirects to `<FRONTEND_URL>/profile.html` automatically when `authenticated` is `true`

### US-2: Initiate SSO Login with PKCE
**As a** visitor on the static HTML page  
**I want** to click a "Sign in with Google" button  
**So that** I am redirected to Google's login via WorkOS SSO with a PKCE-secured flow

#### Acceptance Criteria
- [ ] Clicking the button navigates the browser to `<BFF_URL>/auth/login`
- [ ] The BFF uses `new PKCE().generate()` from `@workos-inc/node` to produce `codeVerifier` and `codeChallenge`
- [ ] The `codeVerifier` is stored in the server-side session before the redirect
- [ ] The BFF redirects to the WorkOS authorization URL with `codeChallenge` and `codeVerifier` included, within 500ms

### US-3: Complete SSO Callback with PKCE Verification
**As a** user returning from Google's login  
**I want** the BFF to handle the WorkOS callback  
**So that** my session is established after the PKCE code exchange is verified

#### Acceptance Criteria
- [ ] The BFF exposes `GET /auth/callback` and accepts the WorkOS `code` parameter
- [ ] The BFF retrieves the stored `codeVerifier` from the session
- [ ] The BFF exchanges the `code` + `codeVerifier` for a WorkOS profile via the WorkOS SDK
- [ ] On success, the BFF stores the user profile in the server-side session, clears the `codeVerifier`, and redirects to `<FRONTEND_URL>/profile.html`
- [ ] On failure (invalid/missing code or verifier mismatch), the BFF returns a 400 response with a human-readable error message

### US-4: View Protected Profile Page
**As an** authenticated user  
**I want** to see a "You're logged in" page with my name and email  
**So that** I can confirm the SSO flow completed successfully

#### Acceptance Criteria
- [ ] `profile.html` is served by the frontend server at `<FRONTEND_URL>/profile.html`
- [ ] On load, `profile.html` calls `GET /auth/session` (with `credentials: 'include'`); if `authenticated` is `false` it redirects to `<FRONTEND_URL>/`
- [ ] If authenticated, the page displays the user's first name, last name, and email from the session response
- [ ] A "Sign out" link is present on the profile page

### US-5: Sign Out
**As an** authenticated user  
**I want** to click "Sign out"  
**So that** my session is destroyed and I am returned to the login page

#### Acceptance Criteria
- [ ] Clicking "Sign out" navigates the browser to `<BFF_URL>/auth/logout`
- [ ] The BFF destroys the server-side session
- [ ] After logout, the browser is redirected to `<FRONTEND_URL>/` with a 302 status
- [ ] After logout, `GET /auth/session` returns `{ authenticated: false }`

## Non-Functional Requirements

### Environment Flag
- `APP_ENV` controls all environment-dependent behaviour; valid values are `local` and `production`
- When `APP_ENV=local`:
  - `FRONTEND_URL` defaults to `http://localhost:3000`
  - `BFF_URL` defaults to `http://localhost:3001`
  - Cookie `secure` flag is `false`
  - Cookie `sameSite` is `'lax'` (browsers reject `SameSite=None` without `Secure` on HTTP)
- When `APP_ENV=production`:
  - `FRONTEND_URL` and `BFF_URL` must be explicitly set in env vars (BFF throws on startup if missing)
  - Cookie `secure` flag is `true`
  - Cookie `sameSite` is `'none'` (required for cross-origin `fetch` with credentials over HTTPS)
- `.env.example` documents both modes clearly with inline comments

### Servers
- Frontend server runs on port **3000** (local) or the port provided by the host environment
- BFF server runs on port **3001** (local) or the port provided by the host environment
- `npm start` starts both servers concurrently using `concurrently`

### Security — CORS
- The BFF MUST set `Access-Control-Allow-Origin` to the value of `FRONTEND_URL` (never a wildcard)
- The BFF MUST set `Access-Control-Allow-Credentials: true`

### Security — Cookie Flags (§6.1.3.2)
- Session cookies MUST always have the `httpOnly` flag set
- `secure` and `sameSite` values are controlled by `APP_ENV` as described above
- Session cookie name SHOULD use the `__Host-` prefix in `production` mode; plain `sid` in `local` mode (the `__Host-` prefix requires `Secure`)
- The `Domain` attribute SHOULD NOT be set on session cookies

### Security — CSRF Protection (§6.1.3.3)
- CORS `Access-Control-Allow-Origin` is pinned to `FRONTEND_URL` in both modes — no wildcard is ever permitted

### Security — General
- Session secret is loaded from `SESSION_SECRET` env var; BFF throws on startup if missing
- WorkOS API key and Client ID are loaded from `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`; BFF throws on startup if missing
- PKCE `codeVerifier` is generated with `crypto.randomBytes(32).toString('base64url')`; `codeChallenge` is `crypto.createHash('sha256').update(verifier).digest('base64url')` — the `PKCE` class is not available in `@workos-inc/node` v7.x
- `codeVerifier` is deleted from the session immediately after the token exchange (one-time use)

### Performance
- All BFF route responses (excluding the external WorkOS redirect) complete within 1 second under local development conditions

### Dependencies
- The BFF must use `@workos-inc/node` as the sole WorkOS integration library (SSO client, PKCE, profile exchange)

## Out of Scope
- More than two environments (only `local` and `production` are supported)
- Multiple SSO providers (only Google via WorkOS is in scope)
- User persistence in a database (in-memory session only)
- Role-based access control or permissions
- Production deployment / containerization
- Frontend build tooling (Webpack, Vite, etc.) — plain HTML/CSS/JS only
- Refresh token handling or session expiry management
- Unit tests for the static HTML page itself
- Client-side PKCE (PKCE is handled entirely by the BFF, not the browser)

## Quality Check
- [x] All user stories have acceptance criteria
- [x] Acceptance criteria are verifiable (HTTP status codes, JSON shape, env-var-driven URLs, SDK method names)
- [x] NFRs have measurable thresholds (500ms, 1s, port 3000/3001)
- [x] Out-of-scope items explicitly listed
