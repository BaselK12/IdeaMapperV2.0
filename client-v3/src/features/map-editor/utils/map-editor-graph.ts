import type { MapEditorEdge, MapEditorNode, MapEditorNodeData } from "@/features/map-editor/types/map-editor-types"

type UnknownRecord = Record<string, unknown>

const TRANSIENT_NODE_KEYS = new Set([
  "dragging",
  "height",
  "measured",
  "positionAbsolute",
  "resizing",
  "selected",
  "width",
])

const TRANSIENT_EDGE_KEYS = new Set(["selected"])

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function ensureUniqueId(candidate: string, usedIds: Set<string>) {
  if (!usedIds.has(candidate)) {
    usedIds.add(candidate)
    return candidate
  }

  let suffix = 2
  let nextCandidate = `${candidate}-${suffix}`
  while (usedIds.has(nextCandidate)) {
    suffix += 1
    nextCandidate = `${candidate}-${suffix}`
  }

  usedIds.add(nextCandidate)
  return nextCandidate
}

function removeUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(removeUndefinedDeep)
  }

  if (!isRecord(value)) {
    return value
  }

  const cleaned: UnknownRecord = {}
  for (const [key, entryValue] of Object.entries(value)) {
    if (entryValue === undefined) {
      continue
    }

    cleaned[key] = removeUndefinedDeep(entryValue)
  }

  return cleaned
}

function stripKeys(record: UnknownRecord, keys: Set<string>) {
  const cleaned: UnknownRecord = {}

  for (const [key, value] of Object.entries(record)) {
    if (!keys.has(key)) {
      cleaned[key] = value
    }
  }

  return cleaned
}

export function getNodeTitleFromValue(value: unknown, fallback: string) {
  const normalized = asNonEmptyString(value)
  return normalized ?? fallback
}

function getNodeTitleFromRecord(data: UnknownRecord, fallback: string) {
  const fromTitle = asNonEmptyString(data.title)
  if (fromTitle) {
    return fromTitle
  }

  const fromLabel = asNonEmptyString(data.label)
  if (fromLabel) {
    return fromLabel
  }

  return fallback
}

export function normalizeLoadedNodes(rawNodes: unknown): MapEditorNode[] {
  const sourceNodes = Array.isArray(rawNodes) ? rawNodes : []
  const usedIds = new Set<string>()

  return sourceNodes.map((rawNode, index) => {
    const fallbackId = `node-${index + 1}`
    const rawRecord = isRecord(rawNode) ? rawNode : {}
    const rawData = isRecord(rawRecord.data) ? rawRecord.data : {}

    const id = ensureUniqueId(asNonEmptyString(rawRecord.id) ?? fallbackId, usedIds)

    const positionRecord = isRecord(rawRecord.position) ? rawRecord.position : {}
    const position = {
      x: asFiniteNumber(positionRecord.x, 120 + (index % 4) * 220),
      y: asFiniteNumber(positionRecord.y, 120 + Math.floor(index / 4) * 140),
    }

    const title = getNodeTitleFromRecord(rawData, `Node ${index + 1}`)
    const data: MapEditorNodeData = {
      ...rawData,
      title,
    }
    delete (data as UnknownRecord).label

    return {
      ...(rawRecord as Partial<MapEditorNode>),
      data,
      id,
      position,
      type: typeof rawRecord.type === "string" ? rawRecord.type : "mapNode",
    }
  })
}

export function normalizeLoadedEdges(rawEdges: unknown): MapEditorEdge[] {
  const sourceEdges = Array.isArray(rawEdges) ? rawEdges : []
  const usedIds = new Set<string>()

  return sourceEdges.flatMap((rawEdge, index) => {
    const rawRecord = isRecord(rawEdge) ? rawEdge : null
    if (!rawRecord) {
      return []
    }

    const source = asNonEmptyString(rawRecord.source)
    const target = asNonEmptyString(rawRecord.target)
    if (!source || !target) {
      return []
    }

    const rawId = asNonEmptyString(rawRecord.id) ?? `edge-${source}-${target}-${index + 1}`
    const id = ensureUniqueId(rawId, usedIds)

    return [
      {
        ...(rawRecord as Partial<MapEditorEdge>),
        id,
        source,
        target,
      },
    ]
  })
}

export function filterEdgesByExistingNodes(
  edges: MapEditorEdge[],
  nodes: MapEditorNode[]
) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  return edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
  )
}

function serializeNode(node: MapEditorNode) {
  const rawNode = stripKeys(node as unknown as UnknownRecord, TRANSIENT_NODE_KEYS)
  const rawData = isRecord(rawNode.data) ? rawNode.data : {}
  const title = getNodeTitleFromRecord(rawData, `Node ${node.id}`)

  const nodeData: UnknownRecord = {
    ...rawData,
    title,
  }
  delete nodeData.label
  delete nodeData.isEditing

  return removeUndefinedDeep({
    ...rawNode,
    data: nodeData,
    position: {
      x: asFiniteNumber(node.position?.x, 0),
      y: asFiniteNumber(node.position?.y, 0),
    },
    type: typeof node.type === "string" ? node.type : "mapNode",
  })
}

function serializeEdge(edge: MapEditorEdge) {
  const rawEdge = stripKeys(edge as unknown as UnknownRecord, TRANSIENT_EDGE_KEYS)
  return removeUndefinedDeep(rawEdge)
}

export function toPersistedGraph(nodes: MapEditorNode[], edges: MapEditorEdge[]) {
  const sanitizedEdges = filterEdgesByExistingNodes(edges, nodes)

  return {
    edges: sanitizedEdges.map(serializeEdge),
    nodes: nodes.map(serializeNode),
  }
}

export function createGraphSignature(nodes: MapEditorNode[], edges: MapEditorEdge[]) {
  return JSON.stringify(toPersistedGraph(nodes, edges))
}

function nextNumericId(nodes: MapEditorNode[]) {
  if (nodes.length === 0) {
    return "1"
  }

  const numericIds = nodes
    .map((node) => node.id)
    .filter((value) => /^\d+$/.test(value))
    .map((value) => Number.parseInt(value, 10))

  if (numericIds.length === nodes.length) {
    return String(Math.max(...numericIds) + 1)
  }

  return null
}

function fallbackNodeId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }

  return `node-${Date.now()}-${Math.floor(Math.random() * 10_000)}`
}

export function createNodeId(nodes: MapEditorNode[]) {
  return nextNumericId(nodes) ?? fallbackNodeId()
}

export function createNewNode(
  nodes: MapEditorNode[],
  position?: { x: number; y: number }
): MapEditorNode {
  const nextIndex = nodes.length
  const id = createNodeId(nodes)
  const fallbackPosition = {
    x: 140 + (nextIndex % 4) * 220,
    y: 140 + Math.floor(nextIndex / 4) * 140,
  }
  const nextPosition = position
    ? {
        x: asFiniteNumber(position.x, fallbackPosition.x),
        y: asFiniteNumber(position.y, fallbackPosition.y),
      }
    : fallbackPosition

  return {
    data: { title: `Node ${id}` },
    id,
    position: nextPosition,
    style: {
      border: "1.5px solid hsl(var(--border))",
      borderRadius: 14,
      boxShadow: "0 10px 18px hsl(var(--foreground) / 0.08)",
      padding: 0,
    },
    type: "mapNode",
  }
}

export function toRoleCanEdit(role: string) {
  const normalized = role.trim().toLowerCase()
  return normalized === "admin" || normalized === "editor" || normalized === "owner"
}
