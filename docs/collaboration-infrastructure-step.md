# Collaboration Infrastructure — Step 2 Checkpoint

## What was built

### Part A — Direct invites

Admins can invite a specific email address directly from the Share dialog. The flow:

1. Admin opens Share → enters invitee email + selects Viewer or Editor role → clicks Invite.
2. A row is written to `map_invites` (token UUID, 7-day expiry, role limited to viewer/editor).
3. The generated invite URL (`/app/invite/<token>`) is shown for the admin to copy and share.
4. The recipient visits the link, sees a preview (map name, inviter name, role), and clicks Accept.
5. A SECURITY DEFINER RPC verifies the token matches the caller's email, inserts the user into `map_participants`, marks the invite accepted, and returns a JSONB result.
6. On success the recipient is navigated to the map, and a best-effort `map_invite_accepted` notification is fired to the inviter.

Pending invites are listed in the Share dialog with a Revoke button. Invites are loaded only when the Share dialog is open and the user is an admin.

### Part B — Notifications

A `notifications` table stores user-scoped notification rows. Three types are supported:

| Type | Triggered by |
|---|---|
| `mention` | A comment is saved that contains `@mention` of a participant |
| `role_changed` | Admin changes a member's role via the Share dialog |
| `map_invite_accepted` | Invitee accepts a direct invite |

A bell icon appears in both the desktop sidebar and mobile nav header. Unread count is shown as a badge. Clicking opens a panel with a read/unread list, relative timestamps, and a "Mark all read" button. Each notification links to the relevant map (or `/app` as fallback).

Notifications are delivered via a Supabase `postgres_changes INSERT` subscription filtered by `user_id`, so they appear without a page reload while the app is open.

## Files changed

### New files
- `docs/migrations/20260502000000_collaboration_infrastructure.sql` — schema migration (run manually in Supabase)
- `client-v3/src/features/map-workspace/types/map-invites-types.ts`
- `client-v3/src/features/map-workspace/api/map-invites-api.ts`
- `client-v3/src/features/map-workspace/hooks/use-map-invites.ts`
- `client-v3/src/features/notifications/types/notification-types.ts`
- `client-v3/src/features/notifications/api/notifications-api.ts`
- `client-v3/src/features/notifications/hooks/use-notifications.ts`
- `client-v3/src/features/notifications/components/notification-bell.tsx`
- `client-v3/src/pages/map-invite-page.tsx`

### Modified files
- `client-v3/src/App.tsx` — added `/app/invite/:token` route
- `client-v3/src/components/layout/app-shell.tsx` — added `NotificationBell` in sidebar and mobile nav
- `client-v3/src/features/map-workspace/components/map-workspace-shell.tsx` — invite section in Share dialog, role-change notification
- `client-v3/src/features/map-workspace/hooks/use-map-node-comments.ts` — added `mapName` param, fires mention notifications after comment save

## Manual actions required

The SQL migration must be applied in Supabase before the invite and notification features will work:

```
docs/migrations/20260502000000_collaboration_infrastructure.sql
```

Run it in the Supabase SQL editor or via the migration tooling. It creates:
- `map_invites` table with RLS
- `notifications` table with RLS
- `get_map_invite_by_token` SECURITY DEFINER function
- `accept_map_invite` SECURITY DEFINER function
- `create_notification` SECURITY DEFINER function

## Validation

- `npx tsc -b --noEmit` — 0 errors after all changes

## Security notes

- `get_map_invite_by_token` returns data only when the caller's email matches `invitee_email` — prevents invite enumeration.
- `accept_map_invite` atomically verifies email match before inserting into `map_participants`.
- `create_notification` validates `p_type` against an allowed list and skips self-notifications (no user can notify themselves).
- No broad INSERT policy on `notifications` — all cross-user writes go through the SECURITY DEFINER RPC.

## Deferred / out of scope

- Email sending — invite links are copy-pasted manually for now; SMTP/transactional email can be wired later.
- Invite resend — the current UI shows a Revoke button; admins can revoke and re-invite.
- Notification preferences / mute — all notification types are always delivered.
- Deep-link to specific node from mention notification — links go to the map root.
