export type NotificationType = "map_invite_accepted" | "mention" | "role_changed"

export type Notification = {
  createdAt: string
  data: Record<string, unknown>
  id: string
  mapId: string | null
  readAt: string | null
  type: NotificationType
  userId: string
}
