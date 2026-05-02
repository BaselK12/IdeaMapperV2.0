# Stabilization Pass — client-v3

Date: 2026-05-02

## Scope

Stability audit and hardening pass across existing Branchly features in `client-v3`. No new features added.

---

## Hardening Issues Found

### Issue 1 — `saveMapSavedView` / `deleteMapSavedView` crash shell on quota exceeded (CRITICAL)

**Files:** `client-v3/src/features/map-workspace/api/map-saved-views-api.ts`

**Risk:** `saveMapSavedView` called raw `window.localStorage.setItem` with no try-catch. On storage quota exceeded, the exception propagated uncaught through the shell component, crashing the workspace silently. `deleteMapSavedView` had the same issue.

**Fix:** Wrapped both `setItem` calls in try-catch. `saveMapSavedView` now throws a descriptive user-facing error that the shell catches and surfaces via toast. `deleteMapSavedView` swallows the delete failure (stale entry remains; non-critical).

---

### Issue 2 — `saveMapSnapshot` returned unsaved data as success (MEDIUM)

**File:** `client-v3/src/features/map-workspace/api/map-snapshots-api.ts`

**Risk:** The quota-exceeded catch block returned `next` (the new snapshot array) even though nothing was persisted. The shell showed a success toast, but the snapshot was gone on next page load.

**Fix:** The catch block now throws a descriptive error. Shell `handleCreateSnapshot` wraps the call in try-catch and shows a warning toast on failure.

---

### Issue 3 — `handleSaveCurrentView` gave no feedback when viewport was null (MEDIUM)

**File:** `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`

**Risk:** If `canvasViewportRef.current?.getViewport()` returned null (canvas not yet mounted), the function returned silently. User clicked "Save view", nothing happened, no error, no indication.

**Fix:** Added a warning toast: `"View could not be saved — canvas is not ready yet."`

---

### Issue 4 — Snapshot and saved-view IDs used `Date.now()` (LOW)

**File:** `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`

**Risk:** Two saves within the same millisecond produced identical IDs. Second entry would overwrite first in localStorage with no warning.

**Fix:** Added module-level `createLocalId(prefix)` helper that uses `crypto.randomUUID()` when available, falls back to `Date.now() + Math.random()`. Both `handleCreateSnapshot` and `handleSaveCurrentView` now use it.

---

### Issue 5 — `handleRemoveMember` did not refresh participant list (MEDIUM)

**File:** `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`

**Risk:** After removing a member, `mapPresence.refreshMembers()` was never called. The removed user remained in the participant strip until the page was reloaded. The role-change handler had the same call and it worked correctly; the remove handler was simply missing it.

**Fix:** Added `mapPresence.refreshMembers()` call in the success path of `handleRemoveMember`.

---

### Issue 6 — Comments realtime channel had no subscribe status callback (LOW-MEDIUM)

**File:** `client-v3/src/features/map-workspace/hooks/use-map-node-comments.ts`

**Risk:** `channel.subscribe()` was called with no callback. If the subscription failed (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`), realtime comment updates stopped working silently. Other hooks (`use-map-workspace-presence.ts`, `use-map-workspace-live-cursors.ts`) had proper status callbacks.

**Fix:** Added status callback matching the pattern in other presence hooks. Sets `errorMessage` on failure; shown to user via the existing comments error display.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/map-workspace/api/map-saved-views-api.ts` | Added try-catch to `saveMapSavedView` (throws) and `deleteMapSavedView` (swallows) |
| `src/features/map-workspace/api/map-snapshots-api.ts` | Changed `saveMapSnapshot` catch to throw descriptive error |
| `src/features/map-workspace/components/map-workspace-shell.tsx` | Added `createLocalId`; fixed `handleSaveCurrentView` (viewport guard + error catch + UUID); fixed `handleCreateSnapshot` (error catch + UUID); added `mapPresence.refreshMembers()` to `handleRemoveMember` |
| `src/features/map-workspace/hooks/use-map-node-comments.ts` | Added subscribe status callback with error state on channel failure |

---

## Validations Run

| Check | Result |
|---|---|
| `npx tsc -b --noEmit` (client-v3) | **0 errors** — statically verified |
| Browser: save view, snapshot create, member remove | **Not yet verified** — manual test required |
| Browser: storage quota behaviour | **Not yet verified** — requires devtools override |
| Browser: comments channel error recovery | **Not yet verified** — requires network devtools |

---

## What Still Needs Manual Review

1. **Vote persistence for viewers** — `updateNodeVotes` calls `queuePersist` which is gated by `canEditRef`, so viewers won't trigger a server save. However, their local node vote-count updates are lost on reload (server data overrides). This is an acceptable current design but worth documenting if voting for viewers is intended to be purely cosmetic.

2. **Edit lock recovery** — once a permission-lock error fires (`isEditLocked = true`), the only unlock is a mapId or roleCanEdit change. A user whose permissions are restored server-side (e.g., admin re-grants editor) must reload or navigate away and back. No automated recovery. Acceptable for now but should be noted for a future health-check pass.

3. **`deleteMapSnapshot` on quota exceeded** — currently swallows the error (consistent with delete behaviour in saved views). If storage is so full that even a delete-then-rewrite fails, the list may go stale. This is an edge-within-an-edge; acceptable for now.

4. **Comments concurrent edit (last-write-wins)** — `updateMapNodeCommentThreads` does a full overwrite. Two users editing simultaneously lose one set of changes. No optimistic-conflict resolution is in place. This requires a deeper schema change (move to per-comment rows or use Supabase row-level merge). Deferred to a future pass.

---

## What Should Be Done Before Step 2 (Collaboration / AI Features)

- Manual browser smoke test of: save view, create/restore snapshot, remove member, comment errors
- Consider per-comment storage model before adding real-time collaboration (the current last-write-wins will be a problem at scale)
- No blocking issues; all critical crash paths addressed
