# AI Branch Generation — Step Checkpoint

## Plan

Build a focused "AI branch" feature: from a selected node, the user picks a generation mode
(brainstorm / checklist / risks / roadmap / research), optionally adds a short instruction,
and AI returns a subtree that can be inserted into the map.

Architecture constraint: API key must never be in the browser bundle. A Supabase Edge Function
acts as a secure proxy. The frontend calls the edge function via the authenticated Supabase client.

Reuse strategy: AI output is wrapped into a `BuiltInBranchStarter`-shaped object so it feeds
directly into the existing `editor.insertBranchStarter()`. This gives correct anchor-relative
positioning, ID remapping, collapse-expansion, persistence, and undo/redo for free.

**Provider:** Groq (`llama-3.1-8b-instant`) via direct `fetch()` — no SDK dependency.
Override model at any time: `supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile`

## Status

**UI and architecture: fully implemented.**
**Live generation: requires edge function deployment + Anthropic API key (see below).**

## Files changed

### New files
- `supabase/functions/generate-branch/index.ts`
  — Deno edge function. Accepts `{ nodeTitle, nodeDescription, mode, instruction }`, calls
    `claude-3-5-haiku-20241022`, validates and returns `{ nodes, edges }`. Uses
    `ANTHROPIC_API_KEY` from Supabase secrets — never exposed to the browser.

- `client-v3/src/lib/ai-branch-gen.ts`
  — Frontend service boundary. Calls the edge function via `supabase.functions.invoke()`,
    assigns tree layout positions (BFS, 320px per column, 160px per row, vertically centered),
    wraps output as a `BuiltInBranchStarter`. Exports `AiBranchMode`, `AI_BRANCH_MODES`,
    and `generateAiBranch()`.

### Modified files
- `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
  — Added `"ai-branch"` to `WorkspaceDialog` union
  — Added `Loader2`, `Sparkles` to lucide imports
  — Added `generateAiBranch`, `AI_BRANCH_MODES`, `AiBranchMode`, `BuiltInBranchStarter` imports
  — Added state: `aiBranchMode`, `aiBranchInstruction`, `aiBranchResult`,
    `isAiBranchGenerating`, `aiBranchError`
  — `closeDialog` resets all AI state
  — Added handlers: `handleOpenAiBranch`, `handleGenerateAiBranch`, `handleInsertAiBranch`
  — Added "AI branch" inspector section (below "Branch starters", respects read-only)
  — Added `ModalFrame` for `activeDialog === "ai-branch"`: mode pills, instruction input,
    Generate button with spinner, success state with Insert + Retry, error display

- `client-v3/.env.example`
  — Added section documenting edge function deployment and secrets setup

## Validation

- `npx tsc -b --noEmit` — 0 errors
- All new types satisfy `BuiltInBranchStarter` and `MapEditorNode`/`MapEditorEdge` shapes
- `handleInsertAiBranch` calls `editor.insertBranchStarter()` — same path as built-in starters,
  so undo/redo, persistence, and positioning are handled by existing code

## Activation status

**Live and deployed** on project `lvejpzukguidgvcqroyk` (IdeaMapperClean).

Secret `GROQ_API_KEY` is set. Edge function is deployed with JWT verification enabled.
Smoke test confirmed valid `{ nodes, edges }` output from Groq.

To re-deploy after future changes:
```sh
supabase functions deploy generate-branch
```

To change model:
```sh
supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile
supabase functions deploy generate-branch
```

## UX flow (once deployed)

1. User selects a node
2. Inspector shows "AI branch" section below "Branch starters"
3. Click "Generate" → modal opens showing node title as context
4. Pick a mode (Brainstorm / Checklist / Risks / Roadmap / Research)
5. Optionally add a short instruction
6. Click "Generate branch" → spinner → "X nodes ready. Review then insert."
7. Click "Insert branch" → branch attached to selected node, view pans to root
8. Undo (Cmd+Z) works — insertion goes through the standard editor history

## Rate limiting (Step 3.5 — implemented)

**Limit:** 20 AI branch generations per user per rolling 60-minute window.

**Implementation:** In-memory rolling-window rate limiter in the edge function, keyed by the
authenticated user's UUID (extracted from the JWT `sub` claim — platform verifies the signature
before our code runs).

**Known limitation:** The counter is per-function-instance. Supabase may run multiple edge
runtime instances in parallel, so a user hitting different instances sees separate counters.
In practice this provides meaningful protection against runaway single-client usage.
Upgrade path: replace `rateLimitBuckets` with a DB-backed counter if global consistency is needed.

**Counter resets on cold start.** If the function instance restarts, the in-memory counter resets.
This is acceptable for a soft abuse guard; it does not affect correctness.

**Frontend behavior:** When the 429 fires, the structured `{ error: "AI generation limit reached.
Try again in an hour." }` message is surfaced directly in the AI branch modal's error display.
The Supabase SDK sets both `data` and `error` on non-2xx responses; `generateAiBranch` now checks
`data.error` before the SDK `error` object so the human-readable server message is never lost.

## Risks / deferred

- **Review step**: direct insert with undo is the simplest safe UX. A diff preview would be a
  future enhancement.
- **Multiple providers**: Groq only for now. Provider abstraction can be added later.
- **Deeper trees**: the tree layout algorithm works for 1–2 levels. For 3+ levels, positions
  may overlap. The AI prompt encourages flat trees, so this is unlikely in practice.
- **Node color variety**: all AI nodes are currently `color: "violet"`. Color-per-kind is a
  minor future improvement.

## What comes next

After this feature, natural next steps include:
- AI map summary / export assist
- Global rate limiting via DB counter (if per-instance limit proves insufficient)
- Node color variety: map `kind` → distinct color rather than hardcoded `"violet"`
