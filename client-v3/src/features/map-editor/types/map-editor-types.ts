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

export type MapEditorNodePriority = "none" | "low" | "medium" | "high"

export type MapEditorNodeStatus = "none" | "in-progress" | "done" | "blocked"

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
  frameHeight?: number
  frameWidth?: number
  isFrame?: boolean
  kind?: MapEditorNodeKind
  media?: MapEditorNodeMedia | null
  owner?: string
  priority?: MapEditorNodePriority
  status?: MapEditorNodeStatus
  title: string
  votes?: number
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
  isFrame: boolean
  kind: MapEditorNodeKind
  media: MapEditorNodeMedia | null
  outgoingEdgeCount: number
  owner: string
  position: {
    x: number
    y: number
  }
  priority: MapEditorNodePriority
  status: MapEditorNodeStatus
  title: string
  votes: number
}

export type SelectedEdgeSummary = {
  id: string
  label: string
  link: string
  note: string
  sourceNodeId: string
  targetNodeId: string
}
