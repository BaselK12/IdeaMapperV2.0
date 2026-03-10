import type { Edge, Node } from "reactflow"

export type MapEditorNodeData = {
  title: string
  [key: string]: unknown
}

export type MapEditorNode = Node<MapEditorNodeData>
export type MapEditorEdge = Edge

export type MapEditorGraph = {
  edges: MapEditorEdge[]
  id: string
  lastEdited: string | null
  nodes: MapEditorNode[]
}

export type MapEditorSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error"
export type MapEditorSyncStatus = "connecting" | "listening" | "error"

export type SelectedNodeSummary = {
  incomingEdgeCount: number
  id: string
  outgoingEdgeCount: number
  position: {
    x: number
    y: number
  }
  title: string
}

export type SelectedEdgeSummary = {
  id: string
  label: string | null
  sourceNodeId: string
  targetNodeId: string
}
