import type { MapEditorEdge, MapEditorNode } from "@/features/map-editor/types/map-editor-types"

const STORAGE_KEY_PREFIX = "branchly:v3:snapshots:"
const MAX_SNAPSHOTS = 20

export type MapSnapshot = {
  createdAt: string
  edges: MapEditorEdge[]
  id: string
  name: string
  nodes: MapEditorNode[]
}

function isValidSnapshot(value: unknown): value is MapSnapshot {
  if (!value || typeof value !== "object") return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === "string" &&
    typeof s.name === "string" &&
    typeof s.createdAt === "string" &&
    Array.isArray(s.nodes) &&
    Array.isArray(s.edges)
  )
}

function storageKey(mapId: string) {
  return `${STORAGE_KEY_PREFIX}${mapId}`
}

export function loadMapSnapshots(mapId: string): MapSnapshot[] {
  try {
    const raw = localStorage.getItem(storageKey(mapId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidSnapshot)
  } catch {
    return []
  }
}

export function saveMapSnapshot(mapId: string, snapshot: MapSnapshot): MapSnapshot[] {
  const existing = loadMapSnapshots(mapId)
  const next = [snapshot, ...existing.filter((s) => s.id !== snapshot.id)].slice(
    0,
    MAX_SNAPSHOTS
  )
  try {
    localStorage.setItem(storageKey(mapId), JSON.stringify(next))
  } catch {
    throw new Error(
      "Snapshot could not be saved — browser storage is full. Delete old snapshots and try again."
    )
  }
  return next
}

export function deleteMapSnapshot(mapId: string, snapshotId: string): MapSnapshot[] {
  const next = loadMapSnapshots(mapId).filter((s) => s.id !== snapshotId)
  try {
    localStorage.setItem(storageKey(mapId), JSON.stringify(next))
  } catch {
    // ignore
  }
  return next
}
