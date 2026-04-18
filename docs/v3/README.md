# V3 Developer Setup

This repository contains two frontend clients:

- `client/` — V2 (legacy CRA app, largely unchanged)
- `client-v3/` — V3 (Vite + React + TypeScript — **the active app**)

---

## Prerequisites

- Node.js 18+ (20+ recommended)
- npm 9+
- A Supabase project ([supabase.com](https://supabase.com))

---

## Environment Setup

**V3 is the only client in active development. All steps below apply to `client-v3/`.**

### 1. Create your local env file

```bash
cp client-v3/.env.example client-v3/.env.local
```

`.env.local` is gitignored and must never be committed. It is the single source of truth for both the app and the Playwright E2E tests.

### 2. Fill in the values

Open `client-v3/.env.local` and set:

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → your project → **Settings → API → Project URL** |
| `VITE_SUPABASE_ANON_KEY` | Same page → **anon public** key |
| `E2E_ADMIN_EMAIL` | An existing Supabase auth account for E2E admin tests |
| `E2E_ADMIN_PASSWORD` | Password for the admin E2E account |
| `E2E_VIEWER_EMAIL` | A second Supabase auth account for E2E viewer tests |
| `E2E_VIEWER_PASSWORD` | Password for the viewer E2E account |

The `E2E_*` variables are only used by Playwright tests (`npm run test:e2e`). They are not read by the app at runtime.

> **Security note:** `VITE_*` variables are embedded in the browser bundle at build time and are visible to end users. Never put a service role key, database password, or any secret that must stay private in a `VITE_*` variable. The anon key is designed to be public-safe — it is the correct value to use here.

### 3. Verify Supabase is reachable

Free-tier Supabase projects are **auto-paused** after one week of inactivity and return HTTP 503 until restored. If the app shows auth errors after setup, go to [supabase.com](https://supabase.com), open your project, and click **Restore project**.

---

## Install Dependencies

From the repo root (installs all workspaces at once):

```bash
npm install
```

Or per-app:

```bash
cd client-v3 && npm install
```

---

## Run V3 Locally

```bash
# From repo root:
npm run dev:v3

# Or directly:
cd client-v3 && npm run dev
```

App runs at `http://localhost:5173`.

Routes:
- `/` — landing page
- `/auth` — sign in / sign up
- `/app` — protected dashboard (requires auth)
- `/app/map/:mapId` — map editor (requires auth + map participant)

---

## Build

```bash
# From repo root:
npm run build:v3

# Or directly:
cd client-v3 && npm run build
```

---

## E2E Tests (Playwright)

Tests hit the real Supabase project. Ensure both E2E accounts exist in your project and `.env.local` has their credentials before running.

```bash
cd client-v3

# Headless (CI-style):
npm run test:e2e

# With browser UI:
npm run test:e2e:headed
```

See `client-v3/e2e/.env.test.example` for details on the E2E account setup.

---

## Run V2 Locally (legacy only)

```bash
npm run dev:v2
```

V2 reads `client/.env.local`. Copy `client/.env.example` to `client/.env.local` and fill in the same Supabase URL and anon key.
