const STORAGE_KEY_PREFIX = "branchly:v3:node-votes:"

export type MapNodeVotes = Record<string, boolean>

function storageKey(mapId: string) {
  return `${STORAGE_KEY_PREFIX}${mapId}`
}

export function loadMapNodeVotes(mapId: string): MapNodeVotes {
  try {
    const raw = localStorage.getItem(storageKey(mapId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const result: MapNodeVotes = {}
    for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof val === "boolean") {
        result[key] = val
      }
    }
    return result
  } catch {
    return {}
  }
}

export function setMapNodeVote(
  mapId: string,
  nodeId: string,
  voted: boolean
): MapNodeVotes {
  const current = loadMapNodeVotes(mapId)
  const next = { ...current, [nodeId]: voted }
  try {
    localStorage.setItem(storageKey(mapId), JSON.stringify(next))
  } catch {
    // ignore quota errors
  }
  return next
}
