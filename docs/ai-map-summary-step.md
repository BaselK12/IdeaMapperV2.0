# AI Map/Branch Summarization — Step Checkpoint

## Feature status

**Fully implemented and deployed.**

Edge function `summarize-map` is live on project `lvejpzukguidgvcqroyk`.  
Frontend UI is in place with loading, error, copy, and retry states.

---

## Architecture

Same secure proxy pattern as AI branch generation:

```
Browser → supabase.functions.invoke("summarize-map")
        → Supabase Edge Function (Deno, server-side)
        → Groq API (GROQ_API_KEY never in browser)
        → structured JSON response
```

---

## Files created / changed

### New files

**`supabase/functions/summarize-map/index.ts`**
- Deno edge function
- Accepts `{ scope, mapName, nodes, edges }` — compact node/edge summaries only
- Validates: auth (401), rate limit (429), empty graph (400), oversized graph (400, >150 nodes)
- Sanitizes all inputs (title ≤ 80 chars, description ≤ 200 chars, max 400 edges)
- Calls Groq with `temperature: 0.4` (lower than branch gen for more factual output)
- Returns `{ summary, decisions, questions, actions, risks }` — all string arrays

**`client-v3/src/lib/ai-map-summary.ts`**
- Frontend service boundary
- `collectBranchSubgraph(anchorId, nodes, edges)` — BFS from anchor following outgoing edges
- `generateAiSummary(params)` — invokes edge function, checks data.error before SDK error
- `toSummaryNode / toSummaryEdge` — strips transient render data, truncates to safe sizes
- Exports `AiMapSummary` type and `collectBranchSubgraph` for reuse in shell

### Modified files

**`client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`**
- Added `AlignLeft` to lucide imports
- Added imports for `generateAiSummary`, `collectBranchSubgraph`, `AiMapSummary`
- Added `"ai-summary"` to `WorkspaceDialog` union
- Added 5 state vars: `aiSummaryScope`, `aiSummaryResult`, `isAiSummaryLoading`,
  `aiSummaryError`, `aiSummaryCopied`
- `closeDialog` resets all AI summary state
- Added `handleOpenAiSummary(scope)` — sets scope, clears state, opens dialog, triggers generation
- Added `handleGenerateAiSummary(scope)` — collects graph or branch subgraph, calls service
- Added `handleCopyAiSummary()` — builds plain-text copy and copies to clipboard with 2s feedback
- Added **"AI summary" inspector card** in the selected-node section (after "AI branch" card):
  two buttons — "Branch" and "Full map"
- Added **"Summarize" toolbar button** (between Export and More) for quick full-map summary
- Added **`ModalFrame` for `activeDialog === "ai-summary"`**: loading spinner, structured result
  (Summary / Key decisions / Open questions / Action items / Risks/blockers), Copy + Retry buttons,
  error state with retry button

---

## Deployment steps

```sh
# Deploy (already done for initial setup):
supabase functions deploy summarize-map

# The GROQ_API_KEY secret is already set from AI branch generation — no new secret needed.
# The GROQ_MODEL secret is also reused (falls back to llama-3.1-8b-instant).

# To change model:
supabase secrets set GROQ_MODEL=llama-3.3-70b-versatile
supabase functions deploy summarize-map
```

---

## Rate limiting

- **Limit:** 20 summaries per user per rolling 60-minute window
- **Response:** HTTP 429 `{ error: "AI summary limit reached. Try again in an hour." }`
- **Implementation:** In-memory rolling-window rate limiter (same pattern as generate-branch)
- **Known limitation:** Per-instance only; multiple edge runtime instances will have separate
  counters. Upgrade path: shared DB counter if global consistency is needed.

---

## Input size limits

| Parameter | Server-side limit |
|-----------|-------------------|
| Nodes | Max 150 (400 if larger) |
| Edges | Max 400 (truncated silently) |
| Node title | ≤ 80 chars (truncated) |
| Node description | ≤ 200 chars (truncated) |
| Edge note | ≤ 120 chars (truncated) |
| Map name | ≤ 100 chars (truncated) |

---

## Branch traversal behavior

For scope `"branch"`, the frontend uses BFS from the selected node's ID, following
**outgoing edges only** (edge.source === anchorId → edge.target). This collects the anchor
node and all of its downstream descendants.

Incoming edges from parent nodes are intentionally excluded — the summary covers "this branch
and below", not the full context that led to the node.

If the selected node has no outgoing edges, only that single node is summarized.

---

## UX flow

### Summarize full map
1. Click **Summarize** in the toolbar (or open inspector with a node selected → Full map button)
2. Modal opens immediately and begins generating
3. Loading spinner → structured summary appears
4. Optional: Copy to clipboard (plain-text format with section headers)
5. Optional: Retry to regenerate

### Summarize branch
1. Select a node in the map
2. Inspector shows "AI summary" card → click **Branch**
3. Same modal flow as above; description shows "Branch summary for: [node title]"

---

## Known limitations

- **In-memory rate limit** — resets on cold start; per-instance not global
- **Branch direction** — always follows outgoing edges (downstream). Upstream context
  (parent nodes, sibling branches) is not included. This is intentional and predictable.
- **No preview before generation** — summary is generated immediately on modal open.
  A "choose and then generate" flow could be added later if users want to adjust scope first.
- **No map mutation** — summary is read-only; there is no way to "apply" the summary back to
  the map. This is by design.
- **Large maps** — maps with >150 nodes return a 400 error with a clear message.
  For very large maps, users can summarize individual branches instead.
- **Frame nodes** — frame nodes (visual containers) are included in the node list sent to AI
  if present, but they are visually labeled with `isFrame: true` which is stripped by
  `toSummaryNode`. The AI sees their title but not the fact that they are frames.

---

## Manual QA checklist

- [ ] Open a map with several nodes and connections
- [ ] Click **Summarize** in toolbar → modal opens immediately with spinner
- [ ] Summary appears with at least a Summary section and any applicable sections
- [ ] Click **Copy summary** → clipboard contains plain-text with section headers
- [ ] Click **Retry** → regenerates (new result may differ slightly)
- [ ] Close modal → state is reset (re-open shows fresh spinner)
- [ ] Select a node with child nodes → inspector → AI summary → **Branch** → branch only is summarized
- [ ] Select a leaf node (no children) → Branch → single-node summary
- [ ] Verify error message surfaces correctly if edge function is unreachable
- [ ] Verify 429 rate-limit message shows as readable text in modal, not "not deployed" fallback
- [ ] Light mode / dark mode: summary sections readable, borders correct
- [ ] Mobile / narrow: toolbar "Summarize" label hidden on small screens (sm:inline)
- [ ] Map with 0 nodes: "nodes array is required" error shown in modal
- [ ] Map with >150 nodes: clear "too large" error shown in modal

---

## README rewrite status

**Not done.** README was not touched in this step per instructions.
