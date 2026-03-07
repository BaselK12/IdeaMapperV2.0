export type MapParticipantRole = "viewer" | "editor" | "admin" | string

export type AccessibleMap = {
  description: string
  id: string
  lastEdited: string | null
  name: string
  ownerId: string | null
  role: MapParticipantRole
}

export type CreateMapPayload = {
  description?: string
  name: string
}

export type JoinMapPayload = {
  mapId: string
  mapName: string
  userId: string
}

export type JoinMapOutcome = "joined" | "already-member"

export type JoinMapErrorCode = "invalid-map-id" | "name-mismatch" | "backend"

export class JoinMapFlowError extends Error {
  code: JoinMapErrorCode

  constructor(code: JoinMapErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = "JoinMapFlowError"
  }
}
