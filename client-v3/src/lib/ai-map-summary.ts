import type { MapEditorEdge, MapEditorNode } from "@/features/map-editor/types/map-editor-types"
import { supabase } from "@/lib/supabase"

export type AiMapSummary = {
  actions: string[]
  decisions: string[]
  questions: string[]
  risks: string[]
  summary: string
}

type SummaryNode = {
  description?: string
  id: string
  kind?: string
  priority?: string
  status?: string
  title: string
  votes?: number
}

type SummaryEdge = {
  note?: string
  source: string
  target: string
}

// BFS from anchorId following outgoing edges — collects the anchor and all downstream nodes.
export function collectBranchSubgraph(
  anchorId: string,
  allNodes: MapEditorNode[],
  allEdges: MapEditorEdge[]
): { edges: MapEditorEdge[]; nodes: MapEditorNode[] } {
  const visited = new Set<string>([anchorId])
  const queue = [anchorId]
  const resultEdges: MapEditorEdge[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of allEdges) {
      if (edge.source === current && !visited.has(edge.target)) {
        visited.add(edge.target)
        queue.push(edge.target)
        resultEdges.push(edge)
      }
    }
  }

  return {
    edges: resultEdges,
    nodes: allNodes.filter((n) => visited.has(n.id)),
  }
}

function toSummaryNode(node: MapEditorNode): SummaryNode {
  const d = node.data
  return {
    ...(d.description?.trim() ? { description: d.description.trim().slice(0, 300) } : {}),
    id: node.id,
    ...(d.kind ? { kind: d.kind } : {}),
    ...(d.priority && d.priority !== "none" ? { priority: d.priority } : {}),
    ...(d.status && d.status !== "none" ? { status: d.status } : {}),
    title: d.title,
    ...(d.votes && d.votes > 0 ? { votes: d.votes } : {}),
  }
}

function toSummaryEdge(edge: MapEditorEdge): SummaryEdge {
  return {
    ...(edge.data?.note?.trim() ? { note: edge.data.note.trim().slice(0, 120) } : {}),
    source: edge.source,
    target: edge.target,
  }
}

function normalizeInvokeError(error: Error): string {
  const msg = error.message ?? ""
  if (
    msg.includes("Edge Function returned a non-2xx") ||
    msg.includes("Failed to send") ||
    msg.includes("not found")
  ) {
    return "AI summary is unavailable — the summarize-map edge function may not be deployed yet."
  }
  return msg || "AI summary failed."
}

export async function generateAiSummary(params: {
  edges: MapEditorEdge[]
  mapName: string
  nodes: MapEditorNode[]
  scope: "map" | "branch"
}): Promise<AiMapSummary> {
  const { data, error } = await supabase.functions.invoke<AiMapSummary | { error: string }>(
    "summarize-map",
    {
      body: {
        edges: params.edges.map(toSummaryEdge),
        mapName: params.mapName,
        nodes: params.nodes.map(toSummaryNode),
        scope: params.scope,
      },
    }
  )

  // Check structured server error first — SDK sets both data and error on non-2xx.
  if (data && typeof data === "object" && "error" in data) {
    throw new Error((data as { error: string }).error || "AI summary failed.")
  }

  if (error) {
    throw new Error(normalizeInvokeError(error))
  }

  if (!data || typeof data !== "object") {
    throw new Error("AI returned an empty summary.")
  }

  return data as AiMapSummary
}
