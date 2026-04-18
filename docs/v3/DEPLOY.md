# IdeaMapper V3 — Deployment Runbook

## Prerequisites

- Node.js 20+
- A Supabase project (see `docs/v3/README.md` for setup)
- A static host: Vercel (preferred) or Netlify

---

## Required environment variables

| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase dashboard → Project Settings → API → anon public key |

Both must be set as environment variables on your host before building.

---

## Build

```bash
cd client-v3
npm ci
npm run build
# Output: client-v3/dist/
```

The `build` script runs `tsc -b` (full type-check) then `vite build`. A type error will fail the build.

To type-check without building:
```bash
npm run typecheck
```

---

## Deploy

### Vercel (recommended)

1. Import the repo in the Vercel dashboard.
2. Set **Root Directory** to `client-v3`.
3. Set **Build Command** to `npm run build`.
4. Set **Output Directory** to `dist`.
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Environment Variables**.
6. Deploy.

`client-v3/vercel.json` already contains the SPA rewrite rule — no extra config needed.

### Netlify

1. Connect the repo. Set **Base directory** to `client-v3`, **Build command** to `npm run build`, **Publish directory** to `dist`.
2. Add env vars under **Site configuration → Environment variables**.
3. Deploy.

`client-v3/public/_redirects` handles SPA routing automatically.

---

## Post-deploy verification

- [ ] Load the root URL (`/`) — landing page renders
- [ ] Navigate to `/auth` — sign-in / sign-up card renders, no console errors
- [ ] Open DevTools Network tab: no 404s on page load
- [ ] Direct-navigate to `/app` — redirected to `/auth` (not a 404)
- [ ] Direct-navigate to `/auth/reset-password` — shows "Verifying reset link…" then transitions to "invalid" after ~8 s (no Supabase redirect token is present; this is correct)
- [ ] Sign up with a new email — confirmation email arrives (if email confirmation is enabled in Supabase)
- [ ] Sign in — redirected to `/app` dashboard

---

## Supabase Auth URL configuration (required once)

In the Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: set to your production domain (e.g. `https://ideamapper.example.com`)
- **Redirect URLs**: add both:
  - `http://localhost:5173/auth/reset-password` (development)
  - `https://ideamapper.example.com/auth/reset-password` (production)

Without the production redirect URL, password reset emails will fail.

---

## Rollback

Vercel and Netlify both keep full deploy history. To roll back:

- **Vercel**: Deployments tab → click any previous deploy → **Promote to Production**
- **Netlify**: Deploys tab → click any previous deploy → **Publish deploy**

No database migrations need to be reversed for a frontend-only rollback.
