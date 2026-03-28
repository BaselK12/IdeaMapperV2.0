# AGENTS.md

## Scope

- ideaMapper is a collaborative mind-mapping app backed by Supabase.
- `client-v3/` is the active product surface. Prefer working there unless the task clearly targets another workspace.
- `client/` and `server/` are legacy surfaces. Leave them alone unless the task explicitly requires them.
- Supabase config and migrations are high-risk because they affect permissions, limits, and shared data.

## Practical Rules

- Read the relevant files before editing. Prefer actual code and checked-in config over prose docs when they disagree.
- Keep diffs small and focused. Prefer existing patterns, helpers, and structure over new abstractions.
- In `client-v3/src/features/`, follow the existing `api/`, `hooks/`, `components/`, `types/` layout.
- In V3, use the `@/*` import alias and reuse shared utilities and UI primitives before creating new ones.
- Treat shared/global config, templates, fixtures, and automation as high-risk. Avoid changing them unless the task depends on them.
- Do not change app logic, tests, pipelines, or database files for a documentation or workflow task.

## Plan Before Editing

- If the task is multi-file, ambiguous, or touches shared/high-risk files, pause and summarize before editing:
  1. issue classification: `test issue`, `product bug`, `environment/pipeline issue`, or `missing requirement / ambiguous behavior`
  2. root cause
  3. files to change
  4. why the chosen approach is the safest low-blast-radius option

## High-Risk Areas

- root `package.json` and lockfiles
- `.env.example`
- `supabase/config.toml`
- `supabase/migrations/*`
- `client-v3/playwright.config.ts`
- `client-v3/e2e/*`
- `client-v3/src/components/ui/*`
- `client-v3/src/App.tsx`
- `client-v3/src/main.tsx`
- `client-v3/src/components/layout/app-shell.tsx`
- `client-v3/src/features/auth/auth-context.tsx`
- `scripts/uploadTemplates.js`
- anything under legacy `client/` or `server/`

## Validation

- Run the narrowest relevant validation first.
- For most V3 changes, start in `client-v3/` with `npm run lint` or `npm run build`.
- Root convenience aliases are `npm run dev:v3` and `npm run build:v3`.
- Run Playwright only when needed and when env is available. It uses a real Supabase project, runs with one worker, and `client-v3/e2e/setup/global-setup.ts` mutates shared test state.
- If validation depends on missing env, external services, or risky shared state, say so explicitly instead of guessing.

## Final Summary

- Include:
  1. root cause
  2. files changed
  3. why this approach is safest
  4. what was intentionally not changed
