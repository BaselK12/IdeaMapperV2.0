export type MapInviteRole = "editor" | "viewer"

export type MapInvite = {
  acceptedAt: string | null
  createdAt: string
  expiresAt: string
  id: string
  inviteeEmail: string
  mapId: string
  role: MapInviteRole
  token: string
}

export type MapInvitePreview = {
  createdAt: string
  expiresAt: string
  inviteId: string
  invitedById: string
  invitedByName: string
  inviteeEmail: string
  mapId: string
  mapName: string
  role: MapInviteRole
}

export type AcceptInviteResult =
  | { mapId: string; mapName: string; role: MapInviteRole; success: true }
  | {
      error: "email_mismatch" | "not_authenticated" | "not_found" | "unknown"
      success: false
    }
