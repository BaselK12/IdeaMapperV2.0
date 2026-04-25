const STORAGE_KEY_PREFIX = "branchly:v3:dashboard:"
const MAX_RECENT_MAPS = 8

export type MapDashboardPreferences = {
  pinnedMapIds: string[]
  recentMapIds: string[]
}

const emptyPreferences: MapDashboardPreferences = {
  pinnedMapIds: [],
  recentMapIds: [],
}

function getStorageKey(userId: string) {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  const seenIds = new Set<string>()

  return value.filter((entry): entry is string => {
    if (typeof entry !== "string") {
      return false
    }

    const normalizedId = entry.trim()
    if (!normalizedId || seenIds.has(normalizedId)) {
      return false
    }

    seenIds.add(normalizedId)
    return true
  })
}

export function loadMapDashboardPreferences(
  userId: string | undefined
): MapDashboardPreferences {
  if (!userId || typeof window === "undefined") {
    return emptyPreferences
  }

  try {
    const rawValue = window.localStorage.getItem(getStorageKey(userId))
    if (!rawValue) {
      return emptyPreferences
    }

    const parsedValue = JSON.parse(rawValue) as Partial<MapDashboardPreferences>
    return {
      pinnedMapIds: normalizeIdList(parsedValue.pinnedMapIds),
      recentMapIds: normalizeIdList(parsedValue.recentMapIds).slice(0, MAX_RECENT_MAPS),
    }
  } catch {
    return emptyPreferences
  }
}

export function saveMapDashboardPreferences(
  userId: string | undefined,
  preferences: MapDashboardPreferences
) {
  if (!userId || typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(
    getStorageKey(userId),
    JSON.stringify({
      pinnedMapIds: normalizeIdList(preferences.pinnedMapIds),
      recentMapIds: normalizeIdList(preferences.recentMapIds).slice(0, MAX_RECENT_MAPS),
    } satisfies MapDashboardPreferences)
  )
}

export function pruneMapDashboardPreferences(
  preferences: MapDashboardPreferences,
  accessibleMapIds: string[]
) {
  const accessibleMapIdSet = new Set(accessibleMapIds)

  return {
    pinnedMapIds: preferences.pinnedMapIds.filter((mapId) =>
      accessibleMapIdSet.has(mapId)
    ),
    recentMapIds: preferences.recentMapIds.filter((mapId) =>
      accessibleMapIdSet.has(mapId)
    ),
  } satisfies MapDashboardPreferences
}

export function recordRecentMapOpen(
  userId: string | undefined,
  mapId: string
) {
  if (!mapId.trim()) {
    return emptyPreferences
  }

  const currentPreferences = loadMapDashboardPreferences(userId)
  const nextPreferences = {
    ...currentPreferences,
    recentMapIds: [
      mapId,
      ...currentPreferences.recentMapIds.filter((entry) => entry !== mapId),
    ].slice(0, MAX_RECENT_MAPS),
  } satisfies MapDashboardPreferences

  saveMapDashboardPreferences(userId, nextPreferences)
  return nextPreferences
}
