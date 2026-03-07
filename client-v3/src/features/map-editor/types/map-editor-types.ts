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

export type MapEditorSaveStatus = "idle" | "saving" | "saved" | "error"

export type SelectedNodeSummary = {
  id: string
  title: string
}
