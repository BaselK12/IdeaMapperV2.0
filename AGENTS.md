# AGENTS.md

## Project Goals And Boundaries

- ideaMapper is a collaborative mind-mapping application with realtime collaboration, authentication, and map persistence backed by Supabase.
- Active development is centered on `client-v3/` (Vite + React + TypeScript + Supabase). Treat this as the primary app unless the task explicitly targets another workspace.
- `client/` and `server/` are legacy surfaces kept in the repo. Do not modify them unless the task clearly requires it.
- Database behavior, permissions, and limits are enforced in Supabase. Schema changes live in `supabase/migrations/` and carry high blast radius.

## Source Of Truth

- Read the relevant files before editing. Do not rely on old instructions or assumptions when the code or config says otherwise.
- Prefer actual code and checked-in config over prose docs when they disagree.
- Use these as the main operational references:
  - root `package.json`
  - `client-v3/package.json`
  - `client-v3/src/App.tsx`
  - `client-v3/src/main.tsx`
  - `client-v3/playwright.config.ts`
  - `supabase/config.toml`
  - `docs/v3/README.md`
- Treat `README.md`, `README.txt`, and `client-v3/README.md` as supporting or historical context. They are not the primary workflow spec.

## Repository Conventions

- In `client-v3/src/features/`, follow the existing feature structure: `api/`, `hooks/`, `components/`, `types/`.
- Prefer existing patterns, helpers, and conventions over introducing new abstractions.
- Use the V3 path alias `@/*` for imports instead of adding deep relative import chains.
- Reuse shared V3 primitives before creating new ones, especially:
  - `client-v3/src/components/ui/*`
  - `client-v3/src/lib/*`
  - feature-level hooks and API modules
- Keep changes aligned with the current route and shell structure:
  - `client-v3/src/App.tsx`
  - `client-v3/src/components/layout/app-shell.tsx`
- Realtime collaboration and editor behavior are sensitive areas. Be careful in:
  - `client-v3/src/features/map-editor/*`
  - `client-v3/src/features/map-workspace/*`
  - `client-v3/src/features/auth/*`
  - `client-v3/src/lib/supabase.ts`

## Safe Working Style

- Read touched files and nearby consumers before editing.
- Keep diffs small and focused. Avoid broad refactors unless they are clearly justified by the task.
- Minimize blast radius. Prefer the smallest local change that solves the actual problem.
- Do not change application logic, tests, pipelines, or shared automation for a documentation or workflow migration unless it is required.
- Assume the worktree may already contain user changes. Never revert unrelated edits.
- If you need to touch a shared or global file, state why that file is necessary and what consumers were checked first.

## Root Cause Rule Before Major Edits

Before major edits, multi-file changes, or changes to shared/global files, summarize the following first:

1. Issue classification: `test issue`, `product bug`, `environment/pipeline issue`, or `missing requirement / ambiguous behavior`
2. Root cause
3. Files you intend to change
4. Why this approach is the safest low-blast-radius option

## High-Risk Files And Shared Infrastructure

Treat these as high-risk and avoid editing them unless the task truly depends on them:

- root `package.json` and lockfiles
- `.env.example`
- `supabase/config.toml`
- `supabase/migrations/*`
- `client-v3/playwright.config.ts`
- `client-v3/e2e/setup/*`
- `client-v3/e2e/helpers/*`
- `client-v3/e2e/.env.test.example`
- `client-v3/e2e/.test-state.json`
- `client-v3/src/components/ui/*`
- `client-v3/src/App.tsx`
- `client-v3/src/main.tsx`
- `client-v3/src/components/layout/app-shell.tsx`
- `client-v3/src/features/auth/auth-context.tsx`
- `scripts/uploadTemplates.js`
- anything under legacy `client/` or `server/`

Notes:

- No repo-level CI workflow files are currently checked in, so the main shared automation surfaces are the Playwright harness and Supabase configuration.
- `scripts/uploadTemplates.js` is a legacy Firebase Admin script with machine-specific credentials. Do not expand or normalize it unless a task explicitly targets that legacy workflow.

## Validation Expectations

- Run the narrowest relevant validation first.
- For most V3 code changes, start with the smallest applicable command in `client-v3/`:
  - `npm run lint`
  - `npm run build`
- From the repo root, the convenience aliases are:
  - `npm run dev:v3`
  - `npm run build:v3`
- Use Playwright only when the task affects flows covered by E2E and the required env is available:
  - `npm run test:e2e --workspace client-v3`
- Be careful with E2E:
  - it uses a real Supabase project
  - it runs with one worker on purpose
  - it depends on `client-v3/.env.local`
  - `client-v3/e2e/setup/global-setup.ts` creates or resets shared test state
- If validation requires missing env, external services, or could mutate shared remote state, say that explicitly instead of guessing.
- Do not run repo-wide validation by default when only one workspace changed.

## Shared Files, Templates, Fixtures, And Automation

- Treat shared/global config, templates, fixtures, and pipelines as high-risk.
- Read the existing helper, fixture, or setup file before changing it.
- Prefer extending an existing helper over creating a parallel one.
- Do not casually edit shared UI primitives, Playwright setup, env examples, or Supabase migrations for feature work.
- Avoid unnecessary edits to shared components that affect multiple pages or tests.

## Workspace Guidance

- `client-v3/` is the current product surface.
- `client/` is a legacy CRA client and still contains older Firebase-era patterns.
- `server/` is a legacy Express/Socket.IO surface and is not the primary backend for the active app.
- If a task can be solved entirely inside `client-v3/`, keep it there.

## Delivery Expectations

Final summaries should include:

1. Root cause
2. Files changed
3. Why this approach is safest
4. What was intentionally not changed

When relevant, also state whether the problem was primarily a `test issue`, `product bug`, `environment/pipeline issue`, or `missing requirement / ambiguous behavior`.
