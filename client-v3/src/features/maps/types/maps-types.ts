import type {
  MapEditorEdge,
  MapEditorNode,
} from "@/features/map-editor/types/map-editor-types"

export type MapParticipantRole = "viewer" | "editor" | "admin" | string

export type AccessibleMap = {
  description: string
  id: string
  lastEdited: string | null
  name: string
  ownerName: string | null
  ownerId: string | null
  role: MapParticipantRole
}

export type CreateMapPayload = {
  description?: string
  name: string
}

export type CreateSeededMapPayload = CreateMapPayload & {
  edges: MapEditorEdge[]
  nodes: MapEditorNode[]
}

export type MapSeedGraph = {
  edges: MapEditorEdge[]
  nodes: MapEditorNode[]
}

export type BuiltInMapTemplate = {
  description: string
  graph: MapSeedGraph
  id: string
  name: string
  suggestedDescription: string
  suggestedName: string
  summary: string
}

export type BuiltInBranchStarter = {
  description: string
  graph: MapSeedGraph
  id: string
  name: string
  rootNodeId: string
  summary: string
}

export type UpdateMapDetailsPayload = {
  description?: string
  mapId: string
  name: string
}

export type UpdatedMapDetails = {
  description: string
  id: string
  lastEdited: string | null
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
