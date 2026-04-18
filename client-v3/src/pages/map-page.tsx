import { useParams } from "react-router-dom"

import { ErrorBoundary } from "@/components/error-boundary"
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

  // ── 1. Auth loading ───────────────────────────────────────────────────────
  // ProtectedRoute already gates on isLoading, so this is always false when
  // MapPage renders via normal routing. Kept as defense-in-depth in case
  // MapPage is ever rendered in a context without ProtectedRoute above it.
  if (isAuthLoading) {
    return <MapWorkspaceLoading />
  }

  // ── 2. Invalid map ID ─────────────────────────────────────────────────────
  // Pure URL validation — deterministic, no network dependency.
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

  // ── 3. No user ────────────────────────────────────────────────────────────
  // Auth resolved but session is absent. ProtectedRoute redirects before
  // reaching here; this guards against unusual render contexts.
  if (!user?.id) {
    return (
      <MapWorkspaceState
        detail="Your session is not available right now. Please sign in again."
        variant="error"
      />
    )
  }

  // ── 4. Query pending ──────────────────────────────────────────────────────
  // isPending covers both:
  //   a) query enabled + actively fetching (status='pending', fetchStatus='fetching')
  //   b) query disabled with no cached data (status='pending', fetchStatus='idle')
  // Using isLoading (the v5 subset) would miss case (b) and could allow a
  // brief render of the "no data" error state before the fetch completes.
  if (mapWorkspaceQuery.isPending) {
    return <MapWorkspaceLoading />
  }

  // ── 5. Query error ────────────────────────────────────────────────────────
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

  // ── 6. No data (defensive) ────────────────────────────────────────────────
  // After steps 4 and 5, status must be 'success', so data is always defined.
  // This guard is kept as a narrowing hint for TypeScript and as a safety net.
  if (!mapWorkspaceQuery.data) {
    return (
      <MapWorkspaceState
        detail="Map data was not returned for this route."
        variant="error"
      />
    )
  }

  // ── 7. Success ────────────────────────────────────────────────────────────
  // A tighter ErrorBoundary wraps the workspace shell so that runtime errors
  // inside the map editor show a recovery UI rather than crashing the whole
  // app. The boundary is keyed on mapId so navigating to a different map
  // always resets a previously-errored boundary.
  return (
    <ErrorBoundary
      fallback={
        <MapWorkspaceState
          detail="An unexpected error occurred in the map editor."
          onRetry={() => window.location.reload()}
          variant="error"
        />
      }
      key={normalizedMapId}
    >
      <MapWorkspaceShell currentUser={user} map={mapWorkspaceQuery.data} />
    </ErrorBoundary>
  )
}
