export type MapWorkspaceRole = "viewer" | "editor" | "admin" | string

export type MapWorkspace = {
  description: string
  id: string
  lastEdited: string | null
  name: string
  ownerId: string | null
  role: MapWorkspaceRole
}

export type MapWorkspaceLoadErrorCode = "not-found" | "no-access" | "unknown"

export class MapWorkspaceLoadError extends Error {
  code: MapWorkspaceLoadErrorCode

  constructor(code: MapWorkspaceLoadErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = "MapWorkspaceLoadError"
  }
}
