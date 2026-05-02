const STORAGE_KEY_PREFIX = "branchly:v3:saved-views:"

export type MapSavedView = {
  createdAt: string
  id: string
  name: string
  viewport: {
    x: number
    y: number
    zoom: number
  }
}

function getStorageKey(mapId: string) {
  return `${STORAGE_KEY_PREFIX}${mapId}`
}

function isValidViewport(
  value: unknown
): value is { x: number; y: number; zoom: number } {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.x === "number" &&
    typeof record.y === "number" &&
    typeof record.zoom === "number"
  )
}

function isValidSavedView(value: unknown): value is MapSavedView {
  if (!value || typeof value !== "object") {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    record.id.trim().length > 0 &&
    typeof record.name === "string" &&
    typeof record.createdAt === "string" &&
    isValidViewport(record.viewport)
  )
}

export function loadMapSavedViews(mapId: string): MapSavedView[] {
  if (!mapId || typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(mapId))
    if (!raw) {
      return []
    }

    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isValidSavedView)
  } catch {
    return []
  }
}

export function saveMapSavedView(
  mapId: string,
  view: MapSavedView
): MapSavedView[] {
  if (!mapId || typeof window === "undefined") {
    return []
  }

  const existing = loadMapSavedViews(mapId)
  const next = [view, ...existing.filter((v) => v.id !== view.id)]
  try {
    window.localStorage.setItem(getStorageKey(mapId), JSON.stringify(next))
  } catch {
    throw new Error(
      "View could not be saved — browser storage is full. Delete old views or snapshots and try again."
    )
  }
  return next
}

export function deleteMapSavedView(
  mapId: string,
  viewId: string
): MapSavedView[] {
  if (!mapId || typeof window === "undefined") {
    return []
  }

  const existing = loadMapSavedViews(mapId)
  const next = existing.filter((v) => v.id !== viewId)
  try {
    window.localStorage.setItem(getStorageKey(mapId), JSON.stringify(next))
  } catch {
    // Delete failures are non-critical — stale entry remains until storage is freed
  }
  return next
}
