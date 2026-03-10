import type { User } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import {
  fetchMapParticipantProfiles,
  fetchMapParticipantRoleRows,
  fetchMapPresenceRows,
  type MapParticipantProfileRow,
  type MapParticipantRoleRow,
  upsertMapPresenceHeartbeat,
} from "@/features/map-workspace/api/map-workspace-presence-api"
import type {
  MapWorkspaceParticipant,
  MapWorkspaceParticipantPresence,
  MapWorkspaceParticipantRole,
} from "@/features/map-workspace/types/map-workspace-presence-types"
import { supabase } from "@/lib/supabase"

const PRESENCE_HEARTBEAT_MS = 12000
const PRESENCE_REFRESH_MS = 15000
const PRESENCE_COLORS = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A8",
  "#A833FF",
  "#33FFF5",
  "#FFC233",
  "#FF3333",
  "#33FF8E",
  "#8E33FF",
  "#FF8E33",
  "#33A8FF",
  "#57FF33",
]

type UseMapWorkspacePresenceParams = {
  currentUser: User
  currentUserRole: string
  mapId: string
  ownerId: string | null
}

type UseMapWorkspacePresenceResult = {
  errorMessage: string | null
  isLoading: boolean
  isPresenceUnavailable: boolean
  participants: MapWorkspaceParticipant[]
  retry: () => void
}

type PresenceLookup = {
  isAvailable: boolean
  onlineByUserId: Map<string, boolean>
}

type RefreshRosterOptions = {
  showLoading?: boolean
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error."
}

function mapPresenceStatus(
  isPresenceAvailable: boolean,
  isOnline: boolean
): MapWorkspaceParticipantPresence {
  if (!isPresenceAvailable) {
    return "unknown"
  }

  return isOnline ? "online" : "offline"
}

function colorFromUserId(userId: string) {
  if (!userId) {
    return "#0EA5E9"
  }

  let hash = 0
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0
  }

  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]
}

function normalizeParticipantRole(
  role: string | null | undefined,
  ownerId: string | null,
  userId: string
): MapWorkspaceParticipantRole {
  if (ownerId && userId === ownerId) {
    return "admin"
  }

  const normalizedRole = normalizeOptionalText(role).toLowerCase()
  if (normalizedRole === "admin" || normalizedRole === "owner") {
    return "admin"
  }

  if (normalizedRole === "editor" || normalizedRole === "member") {
    return "editor"
  }

  if (normalizedRole === "viewer") {
    return "viewer"
  }

  return "viewer"
}

function getCurrentUserDisplayName(currentUser: User) {
  const metadata = currentUser.user_metadata
  const preferredMetadataKeys = ["username", "full_name", "name"]

  for (const key of preferredMetadataKeys) {
    const value = normalizeOptionalText(metadata?.[key])
    if (value) {
      return value
    }
  }

  const emailName = normalizeOptionalText(currentUser.email?.split("@")[0])
  if (emailName) {
    return emailName
  }

  return "You"
}

function sortParticipants(
  firstParticipant: MapWorkspaceParticipant,
  secondParticipant: MapWorkspaceParticipant
) {
  if (firstParticipant.isCurrentUser !== secondParticipant.isCurrentUser) {
    return firstParticipant.isCurrentUser ? -1 : 1
  }

  const presenceOrder: Record<MapWorkspaceParticipantPresence, number> = {
    offline: 2,
    online: 0,
    unknown: 1,
  }
  const firstPresenceWeight = presenceOrder[firstParticipant.presence]
  const secondPresenceWeight = presenceOrder[secondParticipant.presence]

  if (firstPresenceWeight !== secondPresenceWeight) {
    return firstPresenceWeight - secondPresenceWeight
  }

  return firstParticipant.displayName.localeCompare(
    secondParticipant.displayName,
    undefined,
    {
      sensitivity: "base",
    }
  )
}

function ensureCurrentUserRoleRow(
  roleRows: MapParticipantRoleRow[],
  currentUserId: string,
  currentUserRole: string
) {
  const hasCurrentUserRow = roleRows.some((row) => row.user_id === currentUserId)
  if (hasCurrentUserRow) {
    return roleRows
  }

  return [{ role: currentUserRole, user_id: currentUserId }, ...roleRows]
}

function buildParticipants(params: {
  currentUserDisplayName: string
  currentUserId: string
  currentUserRole: string
  ownerId: string | null
  presenceLookup: PresenceLookup
  profileRows: MapParticipantProfileRow[]
  roleRows: MapParticipantRoleRow[]
}) {
  const profilesByUserId = new Map<string, MapParticipantProfileRow>(
    params.profileRows.map((profile) => [profile.id, profile])
  )
  const roleByUserId = new Map<string, string | null>()

  for (const roleRow of params.roleRows) {
    if (!roleRow.user_id || roleByUserId.has(roleRow.user_id)) {
      continue
    }

    roleByUserId.set(roleRow.user_id, roleRow.role)
  }

  if (!roleByUserId.has(params.currentUserId)) {
    roleByUserId.set(params.currentUserId, params.currentUserRole)
  }

  const participants = Array.from(roleByUserId.entries()).map(
    ([userId, rawRole]) => {
      const profile = profilesByUserId.get(userId)
      const profileName = normalizeOptionalText(profile?.username)
      const fallbackName =
        userId === params.currentUserId ? params.currentUserDisplayName : "Member"
      const displayName = profileName || fallbackName
      const avatarUrl = normalizeOptionalText(profile?.profile_picture) || null
      const isOnline = params.presenceLookup.onlineByUserId.get(userId) ?? false

      return {
        avatarUrl,
        displayName,
        id: userId,
        isCurrentUser: userId === params.currentUserId,
        presence: mapPresenceStatus(params.presenceLookup.isAvailable, isOnline),
        role: normalizeParticipantRole(rawRole, params.ownerId, userId),
      } satisfies MapWorkspaceParticipant
    }
  )

  return participants.sort(sortParticipants)
}

export function useMapWorkspacePresence({
  currentUser,
  currentUserRole,
  mapId,
  ownerId,
}: UseMapWorkspacePresenceParams): UseMapWorkspacePresenceResult {
  const currentUserDisplayName = useMemo(
    () => getCurrentUserDisplayName(currentUser),
    [currentUser]
  )
  const currentUserId = currentUser.id

  const [participants, setParticipants] = useState<MapWorkspaceParticipant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPresenceUnavailable, setIsPresenceUnavailable] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sessionRef = useRef(0)

  const loadPresenceLookup = useCallback(
    async (sessionId: number): Promise<PresenceLookup> => {
      try {
        const presenceRows = await fetchMapPresenceRows(mapId)
        if (sessionRef.current !== sessionId) {
          return { isAvailable: false, onlineByUserId: new Map() }
        }

        const onlineByUserId = new Map<string, boolean>()
        for (const presenceRow of presenceRows) {
          if (!presenceRow.user_id) {
            continue
          }

          onlineByUserId.set(presenceRow.user_id, Boolean(presenceRow.online))
        }

        setIsPresenceUnavailable(false)
        return {
          isAvailable: true,
          onlineByUserId,
        }
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          return { isAvailable: false, onlineByUserId: new Map() }
        }

        console.warn("[V3] Presence refresh failed:", toErrorMessage(error))
        setIsPresenceUnavailable(true)
        return {
          isAvailable: false,
          onlineByUserId: new Map(),
        }
      }
    },
    [mapId]
  )

  const refreshPresence = useCallback(
    async (sessionId = sessionRef.current) => {
      const presenceLookup = await loadPresenceLookup(sessionId)
      if (sessionRef.current !== sessionId) {
        return
      }

      setParticipants((currentParticipants) =>
        currentParticipants.map((participant) => {
          const isOnline =
            presenceLookup.onlineByUserId.get(participant.id) ?? false

          return {
            ...participant,
            presence: mapPresenceStatus(presenceLookup.isAvailable, isOnline),
          }
        })
      )
    },
    [loadPresenceLookup]
  )

  const refreshRoster = useCallback(
    async (
      sessionId = sessionRef.current,
      options: RefreshRosterOptions = {}
    ) => {
      if (options.showLoading) {
        setIsLoading(true)
      }

      setErrorMessage(null)

      try {
        const roleRows = await fetchMapParticipantRoleRows(mapId)
        if (sessionRef.current !== sessionId) {
          return
        }

        const rosterRows = ensureCurrentUserRoleRow(
          roleRows,
          currentUserId,
          currentUserRole
        )
        const participantIds = Array.from(
          new Set(rosterRows.map((row) => row.user_id))
        )

        let profileRows: MapParticipantProfileRow[] = []
        try {
          profileRows = await fetchMapParticipantProfiles(participantIds)
        } catch (error) {
          if (sessionRef.current !== sessionId) {
            return
          }

          console.warn("[V3] Participant profile refresh failed:", toErrorMessage(error))
        }

        if (sessionRef.current !== sessionId) {
          return
        }

        const presenceLookup = await loadPresenceLookup(sessionId)
        if (sessionRef.current !== sessionId) {
          return
        }

        setParticipants(
          buildParticipants({
            currentUserDisplayName,
            currentUserId,
            currentUserRole,
            ownerId,
            presenceLookup,
            profileRows,
            roleRows: rosterRows,
          })
        )
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          return
        }

        console.error("[V3] Participant roster refresh failed:", error)
        setErrorMessage(toErrorMessage(error))

        setParticipants((currentParticipants) => {
          if (currentParticipants.length > 0) {
            return currentParticipants
          }

          return [
            {
              avatarUrl: null,
              displayName: currentUserDisplayName,
              id: currentUserId,
              isCurrentUser: true,
              presence: "unknown",
              role: normalizeParticipantRole(
                currentUserRole,
                ownerId,
                currentUserId
              ),
            },
          ]
        })
      } finally {
        if (sessionRef.current === sessionId) {
          setIsLoading(false)
        }
      }
    },
    [
      currentUserDisplayName,
      currentUserId,
      currentUserRole,
      loadPresenceLookup,
      mapId,
      ownerId,
    ]
  )

  useEffect(() => {
    sessionRef.current += 1
    const sessionId = sessionRef.current

    setParticipants([])
    setErrorMessage(null)
    setIsLoading(true)
    setIsPresenceUnavailable(false)

    const writeHeartbeat = async () => {
      try {
        await upsertMapPresenceHeartbeat({
          color: colorFromUserId(currentUserId),
          mapId,
          userId: currentUserId,
          username: currentUserDisplayName,
        })
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          return
        }

        console.warn("[V3] Presence heartbeat failed:", toErrorMessage(error))
      }
    }

    void refreshRoster(sessionId, { showLoading: true })
    void writeHeartbeat()

    const heartbeatTimer = window.setInterval(() => {
      void writeHeartbeat()
    }, PRESENCE_HEARTBEAT_MS)

    const presenceRefreshTimer = window.setInterval(() => {
      void refreshPresence(sessionId)
    }, PRESENCE_REFRESH_MS)

    const channel = supabase
      .channel(`map-workspace-presence-${mapId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `map_id=eq.${mapId}`,
          schema: "public",
          table: "map_participants",
        },
        () => {
          void refreshRoster(sessionId)
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          filter: `map_id=eq.${mapId}`,
          schema: "public",
          table: "map_cursors",
        },
        () => {
          void refreshPresence(sessionId)
        }
      )

    channel.subscribe((status) => {
      if (sessionRef.current !== sessionId) {
        return
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setIsPresenceUnavailable(true)
      }
    })

    return () => {
      window.clearInterval(heartbeatTimer)
      window.clearInterval(presenceRefreshTimer)
      void supabase.removeChannel(channel)
    }
  }, [
    currentUserDisplayName,
    currentUserId,
    mapId,
    refreshPresence,
    refreshRoster,
  ])

  const retry = useCallback(() => {
    const sessionId = sessionRef.current
    void refreshRoster(sessionId, { showLoading: true })
  }, [refreshRoster])

  return {
    errorMessage,
    isLoading,
    isPresenceUnavailable,
    participants,
    retry,
  }
}
