import { supabase } from "@/lib/supabase"

import type { MapEditorGraph, MapEditorEdge, MapEditorNode } from "@/features/map-editor/types/map-editor-types"
import {
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

function normalizeMapGraphError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return "Unexpected map editor error."
  }

  const message = error.message?.toLowerCase() ?? ""
  if (error.code === "22P02" || message.includes("invalid input syntax for type uuid")) {
    return "Map ID is invalid."
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

  return {
    edges: normalizeLoadedEdges(row.edges),
    id: row.id,
    lastEdited: row.last_edited,
    nodes: normalizeLoadedNodes(row.nodes),
  }
}

function normalizeSaveError(error: { code?: string; message?: string } | null) {
  if (!error) {
    return "Could not save map changes."
  }

  const message = error.message?.toLowerCase() ?? ""

  if (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("offline")
  ) {
    return "Network connection was interrupted. Reconnect and try again."
  }

  if (
    error.code === "42501" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("forbidden")
  ) {
    return "You no longer have permission to edit this map."
  }

  if (error.code === "57014" || message.includes("statement timeout")) {
    return "Save timed out. Please try again."
  }

  return error.message || "Could not save map changes."
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
    throw new Error(normalizeSaveError(error))
  }

  if (!data) {
    throw new Error("Save was rejected. You may not have edit access anymore.")
  }
}
