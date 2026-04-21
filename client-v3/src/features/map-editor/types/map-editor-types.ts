import type { Edge, Node } from "reactflow"

export type MapEditorNodeColor =
  | "amber"
  | "emerald"
  | "rose"
  | "sky"
  | "slate"
  | "violet"

export type MapEditorNodeKind =
  | "decision"
  | "idea"
  | "question"
  | "resource"
  | "task"

export type MapEditorNodeMediaType = "image" | "link" | "video"

export type MapEditorNodeMedia = {
  title?: string
  type: MapEditorNodeMediaType
  url: string
}

export type MapEditorNodeData = {
  collapsed?: boolean
  color?: MapEditorNodeColor
  description?: string
  kind?: MapEditorNodeKind
  media?: MapEditorNodeMedia | null
  title: string
  [key: string]: unknown
}

export type MapEditorEdgeData = {
  link?: string
  note?: string
  [key: string]: unknown
}

export type MapEditorNode = Node<MapEditorNodeData>
export type MapEditorEdge = Edge<MapEditorEdgeData>

export type MapEditorGraph = {
  edges: MapEditorEdge[]
  id: string
  lastEdited: string | null
  nodes: MapEditorNode[]
}

export type MapEditorSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"
export type MapEditorSyncStatus = "connecting" | "listening" | "error"

export type SelectedNodeSummary = {
  collapsed: boolean
  color: MapEditorNodeColor
  description: string
  incomingEdgeCount: number
  id: string
  kind: MapEditorNodeKind
  media: MapEditorNodeMedia | null
  outgoingEdgeCount: number
  position: {
    x: number
    y: number
  }
  title: string
}

export type SelectedEdgeSummary = {
  id: string
  label: string
  link: string
  note: string
  sourceNodeId: string
  targetNodeId: string
}
