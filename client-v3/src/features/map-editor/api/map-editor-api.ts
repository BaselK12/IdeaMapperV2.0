import { supabase } from "@/lib/supabase"

import type { MapEditorGraph, MapEditorEdge, MapEditorNode } from "@/features/map-editor/types/map-editor-types"
import {
  filterEdgesByExistingNodes,
  normalizeLoadedEdges,
  normalizeLoadedNodes,
  toPersistedGraph,
} from "@/features/map-editor/utils/map-editor-graph"

type MapGraphRow = {
  edges: unknown
  id: string
  last_edited: string | null
  nodes: unknown
}

export type MapEditorSaveErrorCode =
  | "network"
  | "permission"
  | "timeout"
  | "rejected"
  | "unknown"

export class MapEditorSaveError extends Error {
  code: MapEditorSaveErrorCode

  constructor(code: MapEditorSaveErrorCode, message: string) {
    super(message)
    this.code = code
    this.name = "MapEditorSaveError"
  }
}

function normalizeMapGraphError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return "Unexpected map editor error."
  }

  const message = error.message?.toLowerCase() ?? ""
  if (error.code === "22P02" || message.includes("invalid input syntax for type uuid")) {
    return "Map link is invalid."
  }

  if (
    error.code === "42501" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("forbidden")
  ) {
    return "You do not have access to this map anymore."
  }

  return error.message || "Map data request failed."
}

export async function fetchMapEditorGraphById(mapId: string): Promise<MapEditorGraph> {
  const normalizedMapId = mapId.trim()

  const { data, error } = await supabase
    .from("maps")
    .select("id,nodes,edges,last_edited")
    .eq("id", normalizedMapId)
    .maybeSingle()

  if (error) {
    throw new Error(normalizeMapGraphError(error))
  }

  if (!data) {
    throw new Error("Map data is unavailable for this map.")
  }

  const row = data as MapGraphRow
  const nodes = normalizeLoadedNodes(row.nodes)
  const edges = filterEdgesByExistingNodes(normalizeLoadedEdges(row.edges), nodes)

  return {
    edges,
    id: row.id,
    lastEdited: row.last_edited,
    nodes,
  }
}

function normalizeSaveError(error: { code?: string; message?: string } | null): {
  code: MapEditorSaveErrorCode
  message: string
} {
  if (!error) {
    return {
      code: "unknown",
      message: "Could not save map changes.",
    }
  }

  const message = error.message?.toLowerCase() ?? ""

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("offline")
  ) {
    return {
      code: "network",
      message: "Network connection was interrupted. Reconnect and try again.",
    }
  }

  if (
    error.code === "42501" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("forbidden")
  ) {
    return {
      code: "permission",
      message: "You no longer have permission to edit this map.",
    }
  }

  if (error.code === "57014" || message.includes("statement timeout")) {
    return {
      code: "timeout",
      message: "Save timed out. Please try again.",
    }
  }

  return {
    code: "unknown",
    message: error.message || "Could not save map changes.",
  }
}

export async function saveMapEditorGraphById(
  mapId: string,
  nodes: MapEditorNode[],
  edges: MapEditorEdge[]
) {
  const normalizedMapId = mapId.trim()
  const graph = toPersistedGraph(nodes, edges)

  const { data, error } = await supabase
    .from("maps")
    .update({
      edges: graph.edges,
      last_edited: new Date().toISOString(),
      nodes: graph.nodes,
    })
    .eq("id", normalizedMapId)
    .select("id")
    .maybeSingle()

  if (error) {
    const normalizedError = normalizeSaveError(error)
    throw new MapEditorSaveError(normalizedError.code, normalizedError.message)
  }

  if (!data) {
    throw new MapEditorSaveError(
      "rejected",
      "Map data is unavailable or edit access was removed."
    )
  }
}
