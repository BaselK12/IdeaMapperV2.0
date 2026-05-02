import { useCallback, useEffect, useRef, useState } from "react"

import {
  createMapInvite,
  loadMapInvites,
  revokeMapInvite,
} from "@/features/map-workspace/api/map-invites-api"
import type { MapInvite, MapInviteRole } from "@/features/map-workspace/types/map-invites-types"

type UseMapInvitesParams = {
  enabled: boolean
  mapId: string
}

export function useMapInvites({ enabled, mapId }: UseMapInvitesParams) {
  const [invites, setInvites] = useState<MapInvite[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const sessionRef = useRef(0)

  const load = useCallback(async () => {
    if (!enabled) return
    const sessionId = (sessionRef.current += 1)
    setIsLoading(true)
    setErrorMessage(null)
    try {
      const result = await loadMapInvites(mapId)
      if (sessionRef.current !== sessionId) return
      setInvites(result)
    } catch (error) {
      if (sessionRef.current !== sessionId) return
      setErrorMessage(error instanceof Error ? error.message : "Failed to load invites.")
    } finally {
      if (sessionRef.current === sessionId) setIsLoading(false)
    }
  }, [enabled, mapId])

  useEffect(() => {
    void load()
  }, [load])

  const createInvite = useCallback(
    async (inviteeEmail: string, role: MapInviteRole): Promise<MapInvite | null> => {
      setIsSaving(true)
      setErrorMessage(null)
      try {
        const invite = await createMapInvite({ inviteeEmail, mapId, role })
        setInvites((prev) => [invite, ...prev])
        return invite
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to create invite.")
        return null
      } finally {
        setIsSaving(false)
      }
    },
    [mapId]
  )

  const revokeInvite = useCallback(async (inviteId: string) => {
    try {
      await revokeMapInvite(inviteId)
      setInvites((prev) => prev.filter((inv) => inv.id !== inviteId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to revoke invite.")
    }
  }, [])

  return {
    createInvite,
    errorMessage,
    invites,
    isLoading,
    isSaving,
    revokeInvite,
  }
}
