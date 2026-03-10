import { useParams } from "react-router-dom"

import { useAuth } from "@/features/auth/auth-context"
import { isValidMapId } from "@/features/map-workspace/api/map-workspace-api"
import { MapWorkspaceLoading } from "@/features/map-workspace/components/map-workspace-loading"
import { MapWorkspaceShell } from "@/features/map-workspace/components/map-workspace-shell"
import { MapWorkspaceState } from "@/features/map-workspace/components/map-workspace-state"
import { useMapWorkspaceQuery } from "@/features/map-workspace/hooks/use-map-workspace"
import { MapWorkspaceLoadError } from "@/features/map-workspace/types/map-workspace-types"

export function MapPage() {
  const { mapId } = useParams()
  const { isLoading: isAuthLoading, user } = useAuth()

  const normalizedMapId = mapId?.trim() ?? ""
  const hasValidMapId = Boolean(normalizedMapId) && isValidMapId(normalizedMapId)

  const mapWorkspaceQuery = useMapWorkspaceQuery(normalizedMapId, user?.id)

  if (!hasValidMapId) {
    return (
      <MapWorkspaceState
        detail={
          normalizedMapId
            ? `Map ID "${normalizedMapId}" is not a valid UUID.`
            : "This route is missing a map ID."
        }
        variant="not-found"
      />
    )
  }

  if (mapWorkspaceQuery.isLoading) {
    return <MapWorkspaceLoading />
  }

  if (isAuthLoading) {
    return <MapWorkspaceLoading />
  }

  if (!user?.id) {
    return (
      <MapWorkspaceState
        detail="Your session is not available right now. Please sign in again."
        variant="error"
      />
    )
  }

  if (mapWorkspaceQuery.isError) {
    const error = mapWorkspaceQuery.error
    if (error instanceof MapWorkspaceLoadError) {
      if (error.code === "not-found") {
        return <MapWorkspaceState detail={error.message} variant="not-found" />
      }

      if (error.code === "no-access") {
        return <MapWorkspaceState detail={error.message} variant="no-access" />
      }
    }

    return (
      <MapWorkspaceState
        detail={error instanceof Error ? error.message : "Failed to load this map."}
        onRetry={() => {
          void mapWorkspaceQuery.refetch()
        }}
        variant="error"
      />
    )
  }

  if (!mapWorkspaceQuery.data) {
    return (
      <MapWorkspaceState
        detail="Map data was not returned for this route."
        variant="error"
      />
    )
  }

  return <MapWorkspaceShell currentUser={user} map={mapWorkspaceQuery.data} />
}
