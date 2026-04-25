# Branchly Roadmap Run: Phases 1-3

Run date: 2026-04-24
Workspace: `client-v3`

## Phase 1 — Start faster

Status: done

### 1A — Duplicate current map from workspace

- Status: done
- Files changed: `client-v3/src/features/maps/api/maps-api.ts`, `client-v3/src/features/maps/hooks/use-maps.ts`, `client-v3/src/features/maps/types/maps-types.ts`, `client-v3/src/features/maps/components/map-details-modal.tsx`, `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
- Validation result: `npx eslint` on the touched Phase 1 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Seeded creation now cleans up the new map row on a seed failure, but duplicate flow was not exercised against a live authenticated workspace in this run.
- Manual review notes: Verify in the workspace that `More -> Duplicate map` copies nodes, edges, layout, collapsed state, media, and edge details, then opens only after the copied graph exists.

### 1B — Built-in templates

- Status: done
- Files changed: `client-v3/src/features/maps/api/map-presets.ts`, `client-v3/src/features/maps/components/create-map-modal.tsx`, `client-v3/src/pages/dashboard-page.tsx`
- Validation result: `npx eslint` on the touched Phase 1 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Template set is intentionally small and static for v1. There is no remote template source or user-authored template flow.
- Manual review notes: From the dashboard, open `New map`, switch to `Template`, choose each built-in template, and confirm the created map opens with the expected starter graph and editable content.

### 1C — Branch starters

- Status: done
- Files changed: `client-v3/src/features/maps/api/map-presets.ts`, `client-v3/src/features/map-editor/hooks/use-map-editor.ts`, `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
- Validation result: `npx eslint` on the touched Phase 1 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Starter placement is intentionally local and conservative; it avoids schema work and broad layout changes, but dense maps should still be manually reviewed for overlap.
- Manual review notes: Select a node, insert each branch starter from the inspector, and confirm the new branch attaches to the selected node, remaps IDs cleanly, and focuses the inserted root node.

## Phase 2 — Return-to-work dashboard

### 2A — Resume-work dashboard structure

- Status: done
- Files changed: `client-v3/src/pages/dashboard-page.tsx`
- Validation result: `npx eslint` on the touched Phase 2 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Section data is intentionally derived from current access plus local dashboard preferences; there is no server-side ranking or recommendation layer in this increment.
- Manual review notes: Open the dashboard with a populated workspace and confirm `Recent`, `Pinned`, `Shared with me`, and `Recently updated` all render as distinct useful sections before the full map list.

### 2B — Pinned maps

- Status: done
- Files changed: `client-v3/src/features/maps/api/map-dashboard-preferences.ts`, `client-v3/src/features/maps/components/maps-list.tsx`, `client-v3/src/pages/dashboard-page.tsx`, `client-v3/src/pages/map-page.tsx`
- Validation result: `npx eslint` on the touched Phase 2 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Pins are stored per user in local browser storage for this phase, so they survive refresh and reload on the same device but do not sync across devices.
- Manual review notes: Pin and unpin several maps from the dashboard, refresh the page, and confirm the pinned section and row-level pin state persist correctly.

### 2C — Activity signals

- Status: done
- Files changed: `client-v3/src/features/maps/api/maps-api.ts`, `client-v3/src/features/maps/types/maps-types.ts`, `client-v3/src/features/maps/components/maps-list.tsx`, `client-v3/src/pages/dashboard-page.tsx`
- Validation result: `npx eslint` on the touched Phase 2 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Activity signals currently use `last_edited` plus owner context. There is no separate last-editor identity in the current safe data surface.
- Manual review notes: Confirm map cards and sections show clearer updated timestamps and owner/shared context without becoming visually noisy in dense workspaces.

## Phase 3 — Collaboration depth

### 3A — Node comments

- Status: done
- Files changed: `client-v3/src/features/map-workspace/types/map-node-comments-types.ts`, `client-v3/src/features/map-workspace/api/map-node-comments-api.ts`, `client-v3/src/features/map-workspace/hooks/use-map-node-comments.ts`, `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
- Validation result: `npx eslint` on the touched Phase 3 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Node threads are stored in the existing `maps.node_notes` field, which keeps blast radius low but means comment writes follow the current map edit permissions.
- Manual review notes: Select a node, add several comments, refresh the workspace, and confirm the thread persists, resolves cleanly, and reopens correctly from the node inspector.

### 3B — @mentions

- Status: done
- Files changed: `client-v3/src/features/map-workspace/types/map-node-comments-types.ts`, `client-v3/src/features/map-workspace/hooks/use-map-node-comments.ts`, `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
- Validation result: `npx eslint` on the touched Phase 3 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Mentioning is intentionally MVP-simple. It suggests collaborators from the current map roster and stores mention metadata, but does not create a notification system.
- Manual review notes: In the node comment box, type `@`, choose collaborators from the inline suggestions, post the comment, and confirm the mention text and mention chips render correctly in the thread.

### 3C — Member management and richer sharing

- Status: done
- Files changed: `client-v3/src/features/map-workspace/api/map-workspace-presence-api.ts`, `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx`
- Validation result: `npx eslint` on the touched Phase 3 files passed. `npm run build` passed in `client-v3/`.
- Follow-ups / risks: Sharing still uses the existing link plus invite-code flow. This phase adds clarity and admin controls, not a direct invitation or enterprise policy system.
- Manual review notes: Open `Share map`, verify the clearer join instructions, change a non-owner member between viewer/editor/admin, and remove a non-owner member to confirm the roster updates cleanly.
