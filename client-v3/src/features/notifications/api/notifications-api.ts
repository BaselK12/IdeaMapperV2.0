import { supabase } from "@/lib/supabase"

import type { Notification, NotificationType } from "@/features/notifications/types/notification-types"

function isNotificationType(value: unknown): value is NotificationType {
  return (
    value === "mention" || value === "role_changed" || value === "map_invite_accepted"
  )
}

function normalizeNotification(row: Record<string, unknown>): Notification | null {
  const id = typeof row.id === "string" ? row.id : null
  const userId = typeof row.user_id === "string" ? row.user_id : null
  const createdAt = typeof row.created_at === "string" ? row.created_at : null
  const type = row.type

  if (!id || !userId || !createdAt || !isNotificationType(type)) return null

  return {
    createdAt,
    data:
      typeof row.data === "object" && row.data !== null && !Array.isArray(row.data)
        ? (row.data as Record<string, unknown>)
        : {},
    id,
    mapId: typeof row.map_id === "string" ? row.map_id : null,
    readAt: typeof row.read_at === "string" ? row.read_at : null,
    type,
    userId,
  }
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id,user_id,type,data,map_id,read_at,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40)

  if (error) throw new Error(error.message || "Failed to load notifications.")

  return ((data ?? []) as Record<string, unknown>[])
    .map(normalizeNotification)
    .filter((n): n is Notification => n !== null)
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids)
    .is("read_at", null)

  if (error) throw new Error(error.message || "Failed to mark notifications as read.")
}

// Best-effort: uses a SECURITY DEFINER RPC to write cross-user notifications.
// Errors are intentionally not thrown — callers should fire-and-forget.
export async function createNotificationForUser(params: {
  data: Record<string, unknown>
  mapId: string | null
  type: NotificationType
  userId: string
}): Promise<void> {
  await supabase.rpc("create_notification", {
    p_data: params.data,
    p_map_id: params.mapId,
    p_type: params.type,
    p_user_id: params.userId,
  })
}
