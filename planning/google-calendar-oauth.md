# Google Calendar Integration — OAuth Flow

Mirrors nicquitin's GitHub OAuth architecture: tiny Cloudflare Worker handles the client-secret steps, client keeps the tokens.

## Scope of access

- **Permission**: `https://www.googleapis.com/auth/calendar.readonly`
  (just read; no write-back). Upgrade later if we ever want to create/edit events.
- **Calendars covered**: anything the signed-in user can read — own calendars + any they've accepted invites to or subscribed to (including imported `@import.calendar.google.com` ones).

## Components

### 1. Google Cloud Console (manual, one-time)

- Create a new project "mobiledashboard"
- Enable **Google Calendar API** (APIs & Services → Library)
- Create **OAuth 2.0 Client ID** (Credentials → Create Credentials)
  - Application type: **Web application**
  - Authorized redirect URI: `https://<worker-subdomain>.workers.dev/callback`
- Set **OAuth consent screen** to External, publishing status can stay in Testing while only we use it (add personal Google account as a test user).
- Record `CLIENT_ID` and `CLIENT_SECRET` for wrangler secrets.

### 2. Cloudflare Worker — `oauth-worker.js`

Three endpoints:

| Path | Purpose |
|---|---|
| `GET /authorize` | Redirects browser to Google's OAuth consent with `access_type=offline&prompt=consent` so we receive a `refresh_token`. |
| `GET /callback` | Exchanges `code` for `{access_token, refresh_token, expires_in}` server-side (so `CLIENT_SECRET` never leaves the Worker), posts tokens to `window.opener`, closes popup. |
| `POST /refresh` | Accepts `{refresh_token}`, returns a fresh `{access_token, expires_in}`. CORS locked to `APP_ORIGIN`. |

Secrets (wrangler):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_ORIGIN` — Pages URL (for CORS allow-origin on `/refresh`)

### 3. Client (Vue + Pinia)

- **`useAuthStore`** — `{accessToken, refreshToken, expiresAt}` persisted in `localStorage`.
  - `connect()` opens popup `window.open(`${WORKER}/authorize`)`, listens `message` event, validates `event.origin === WORKER_ORIGIN`, saves tokens.
  - `disconnect()` clears localStorage.
  - `ensureFreshToken()` → if `Date.now() > expiresAt - 60s`, POST to `${WORKER}/refresh`, update store.
- **`useCalendarsStore`** — list of calendars (from `/calendar/v3/users/me/calendarList`), list of events per calendar.
- Every Calendar API call runs `ensureFreshToken()` first, attaches `Authorization: Bearer <access_token>`.

### 4. UI — onboarding

- Settings pane with a "Connect Google Calendar" button
- After connect, list each calendar with enabled/disabled toggle (which feeds the dashboard widget)
- Dashboard widget: upcoming N events across enabled calendars, styled to match theme
- "Disconnect" button clears tokens

## Security tradeoffs (personal-project scope)

- `refresh_token` lives in client `localStorage` — accessible to any JS on that origin. Fine for a personal dashboard, not fine if we ever host this for others.
- Worker's `/refresh` verifies origin via CORS only; there's no user authentication against the worker. Same rationale — personal-scope only.
- If we later productize, move refresh_tokens server-side in Cloudflare KV keyed by an opaque session cookie.

## Deploy changes

The existing `.github/workflows/deploy.yml` already has a `deploy-pages` job. We need to add a `deploy-worker` job (copied from nicquitin) and wire these secrets:

- Repo secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`, `APP_ORIGIN`
- `wrangler.toml` at project root
- Build env: `VITE_OAUTH_PROXY_URL=https://<worker>.workers.dev`, `VITE_GCAL_WORKER_ORIGIN=https://<worker>.workers.dev`

## Open decisions

- Worker name — suggest `mobiledashboard-oauth`
- Multiple users? — no, personal dashboard, one Google account at a time
- Do we also want Transport data + Calendar on the same page, or tabbed? — defer to UI planning
