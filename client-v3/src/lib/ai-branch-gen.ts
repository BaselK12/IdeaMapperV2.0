import type { MapEditorEdge, MapEditorNode } from "@/features/map-editor/types/map-editor-types"
import type { BuiltInBranchStarter } from "@/features/maps/types/maps-types"
import { supabase } from "@/lib/supabase"

export type AiBranchMode = "brainstorm" | "checklist" | "research" | "risks" | "roadmap"

export const AI_BRANCH_MODES: { id: AiBranchMode; label: string }[] = [
  { id: "brainstorm", label: "Brainstorm" },
  { id: "checklist", label: "Checklist" },
  { id: "risks", label: "Risks" },
  { id: "roadmap", label: "Roadmap" },
  { id: "research", label: "Research" },
]

type AiRawNode = {
  description?: string
  id: string
  kind: string
  title: string
}

type AiRawEdge = {
  source: string
  target: string
}

type AiRawGraph = {
  edges: AiRawEdge[]
  nodes: AiRawNode[]
}

const MAP_NODE_STYLE = {
  border: "1.5px solid hsl(var(--border))",
  borderRadius: 14,
  boxShadow: "0 10px 18px hsl(var(--foreground) / 0.08)",
  padding: 0,
}

// Valid node kinds matching the editor type
const VALID_KINDS = new Set(["idea", "task", "question", "decision", "resource"])

function createRuntimeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

// BFS tree layout: root at (0,0), children centered vertically at each depth level.
// Matches the visual style of built-in branch starters.
function layoutTree(
  rootId: string,
  allNodeIds: string[],
  edges: AiRawEdge[]
): Map<string, { x: number; y: number }> {
  const childrenOf = new Map<string, string[]>()
  for (const id of allNodeIds) childrenOf.set(id, [])
  for (const edge of edges) {
    const list = childrenOf.get(edge.source)
    if (list) list.push(edge.target)
  }

  // Assign depth via BFS
  const depth = new Map<string, number>([[rootId, 0]])
  const queue = [rootId]
  while (queue.length > 0) {
    const nodeId = queue.shift()!
    for (const child of childrenOf.get(nodeId) ?? []) {
      if (!depth.has(child)) {
        depth.set(child, (depth.get(nodeId) ?? 0) + 1)
        queue.push(child)
      }
    }
  }

  // Group nodes by depth level
  const byDepth = new Map<number, string[]>()
  for (const [id, d] of depth.entries()) {
    const group = byDepth.get(d) ?? []
    group.push(id)
    byDepth.set(d, group)
  }

  // Assign positions: 320px per column, 160px per row, centered vertically
  const positions = new Map<string, { x: number; y: number }>()
  for (const [d, ids] of byDepth.entries()) {
    const count = ids.length
    ids.forEach((id, i) => {
      positions.set(id, {
        x: d * 320,
        y: Math.round((i - (count - 1) / 2) * 160),
      })
    })
  }

  return positions
}

function buildSeedGraph(rawGraph: AiRawGraph): {
  edges: MapEditorEdge[]
  nodes: MapEditorNode[]
  rootNodeId: string
} {
  // Map AI node IDs → runtime UUIDs
  const idMap = new Map<string, string>()
  for (const rawNode of rawGraph.nodes) {
    idMap.set(rawNode.id, createRuntimeId("node"))
  }

  const rootRuntimeId = idMap.get("root")
  if (!rootRuntimeId) throw new Error("AI response is missing a root node.")

  const positions = layoutTree(
    "root",
    rawGraph.nodes.map((n) => n.id),
    rawGraph.edges
  )

  const nodes: MapEditorNode[] = rawGraph.nodes.map((rawNode) => {
    const pos = positions.get(rawNode.id) ?? { x: 0, y: 0 }
    const kind = VALID_KINDS.has(rawNode.kind)
      ? (rawNode.kind as MapEditorNode["data"]["kind"])
      : "idea"

    return {
      data: {
        color: "violet",
        ...(rawNode.description ? { description: rawNode.description } : {}),
        kind,
        title: rawNode.title,
      },
      id: idMap.get(rawNode.id)!,
      position: pos,
      style: { ...MAP_NODE_STYLE },
      type: "mapNode" as const,
    } satisfies MapEditorNode
  })

  const edges: MapEditorEdge[] = rawGraph.edges.map((rawEdge) => ({
    data: {},
    id: createRuntimeId("edge"),
    source: idMap.get(rawEdge.source) ?? rawEdge.source,
    target: idMap.get(rawEdge.target) ?? rawEdge.target,
    type: "mapEdge" as const,
  }))

  return { edges, nodes, rootNodeId: rootRuntimeId }
}

function normalizeInvokeError(error: Error): string {
  const msg = error.message ?? ""
  if (
    msg.includes("Edge Function returned a non-2xx") ||
    msg.includes("Failed to send") ||
    msg.includes("not found")
  ) {
    return "AI generation is unavailable — the generate-branch edge function may not be deployed yet."
  }
  return msg || "AI generation failed."
}

export async function generateAiBranch(params: {
  instruction: string
  mode: AiBranchMode
  nodeDescription: string
  nodeTitle: string
}): Promise<BuiltInBranchStarter> {
  const { data, error } = await supabase.functions.invoke<AiRawGraph | { error: string }>(
    "generate-branch",
    {
      body: {
        instruction: params.instruction,
        mode: params.mode,
        nodeDescription: params.nodeDescription,
        nodeTitle: params.nodeTitle,
      },
    }
  )

  if (error) {
    throw new Error(normalizeInvokeError(error))
  }

  if (!data || typeof data !== "object") {
    throw new Error("AI returned an empty response.")
  }

  // Server returned a structured error
  if ("error" in data && typeof (data as { error: string }).error === "string") {
    throw new Error((data as { error: string }).error)
  }

  const rawGraph = data as AiRawGraph
  const { edges, nodes, rootNodeId } = buildSeedGraph(rawGraph)

  return {
    description: `AI-generated ${params.mode} branch`,
    graph: { edges, nodes },
    id: "ai-generated",
    name: `AI ${params.mode}`,
    rootNodeId,
    summary: `${nodes.length} nodes`,
  }
}
