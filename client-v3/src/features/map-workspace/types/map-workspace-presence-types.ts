export type MapWorkspaceParticipantRole = "viewer" | "editor" | "admin" | string

export type MapWorkspaceParticipantPresence = "online" | "offline" | "unknown"

export type MapWorkspaceParticipant = {
  avatarUrl: string | null
  displayName: string
  id: string
  isCurrentUser: boolean
  presence: MapWorkspaceParticipantPresence
  role: MapWorkspaceParticipantRole
}
