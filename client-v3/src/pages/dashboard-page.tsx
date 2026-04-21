import { useMemo, useState } from "react"
import {
  AlertCircle,
  FileSearch,
  FolderKanban,
  LogOut,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/auth-context"
import {
  CreateMapModal,
  type CreateMapFormValues,
} from "@/features/maps/components/create-map-modal"
import {
  MapDetailsModal,
  type MapDetailsFormValues,
} from "@/features/maps/components/map-details-modal"
import {
  JoinMapModal,
  type JoinMapFormValues,
} from "@/features/maps/components/join-map-modal"
import { ModalFrame } from "@/features/maps/components/modal-frame"
import { MapsList } from "@/features/maps/components/maps-list"
import {
  useAccessibleMapsQuery,
  useCreateMapMutation,
  useDeleteMapMutation,
  useJoinMapMutation,
  useLeaveMapMutation,
  useUpdateMapDetailsMutation,
} from "@/features/maps/hooks/use-maps"
import {
  type AccessibleMap,
  JoinMapFlowError,
} from "@/features/maps/types/maps-types"

function LoadingRows() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="animate-pulse rounded-xl border border-border/70 bg-card/80 p-4"
          key={index}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="size-10 rounded-xl bg-muted/80" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-44 rounded bg-muted/80" />
                <div className="h-3 w-72 max-w-full rounded bg-muted/80" />
              </div>
            </div>
            <div className="h-6 w-20 rounded-full bg-muted/80" />
          </div>
        </div>
      ))}
    </div>
  )
}

function isObviousTestMap(map: AccessibleMap) {
  const name = map.name.trim().toLowerCase()
  const description = map.description.trim().toLowerCase()

  return (
    name === "e2e viewer test map" ||
    name === "e2e persistence test map" ||
    name.startsWith("e2e persist") ||
    description.includes("e2e viewer") ||
    description.includes("e2e persistence") ||
    description.includes("e2e test")
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinInfoMessage, setJoinInfoMessage] = useState<string | null>(null)
  const [selectedMapForDetails, setSelectedMapForDetails] =
    useState<AccessibleMap | null>(null)
  const [selectedMapForRemoval, setSelectedMapForRemoval] =
    useState<AccessibleMap | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [removalError, setRemovalError] = useState<string | null>(null)

  const mapsQuery = useAccessibleMapsQuery(userId)
  const createMapMutation = useCreateMapMutation(userId)
  const joinMapMutation = useJoinMapMutation(userId)
  const updateMapDetailsMutation = useUpdateMapDetailsMutation(userId)
  const deleteMapMutation = useDeleteMapMutation(userId)
  const leaveMapMutation = useLeaveMapMutation(userId)

  const maps = mapsQuery.data
  const accessibleMaps = useMemo(
    () => (maps ?? []).filter((map) => !isObviousTestMap(map)),
    [maps]
  )
  const normalizedSearchTerm = searchTerm.trim().toLowerCase()

  const filteredMaps = useMemo(() => {
    const sourceMaps = accessibleMaps

    if (!normalizedSearchTerm) {
      return sourceMaps
    }

    return sourceMaps.filter((map) =>
      map.name.toLowerCase().includes(normalizedSearchTerm)
    )
  }, [accessibleMaps, normalizedSearchTerm])

  const hasNoMaps =
    !mapsQuery.isLoading &&
    !mapsQuery.isError &&
    accessibleMaps.length === 0
  const hasNoSearchResults =
    !mapsQuery.isLoading &&
    !mapsQuery.isError &&
    accessibleMaps.length > 0 &&
    filteredMaps.length === 0

  const openCreateModal = () => {
    setCreateError(null)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    if (createMapMutation.isPending) {
      return
    }

    setCreateError(null)
    setIsCreateModalOpen(false)
  }

  const openJoinModal = () => {
    setJoinError(null)
    setJoinInfoMessage(null)
    setIsJoinModalOpen(true)
  }

  const closeJoinModal = () => {
    if (joinMapMutation.isPending) {
      return
    }

    setJoinError(null)
    setJoinInfoMessage(null)
    setIsJoinModalOpen(false)
  }

  const closeDetailsModal = () => {
    if (updateMapDetailsMutation.isPending) {
      return
    }

    setDetailsError(null)
    setSelectedMapForDetails(null)
  }

  const closeRemovalModal = () => {
    if (deleteMapMutation.isPending || leaveMapMutation.isPending) {
      return
    }

    setRemovalError(null)
    setSelectedMapForRemoval(null)
  }

  const handleOpenMap = (mapId: string) => {
    navigate(`/app/map/${mapId}`)
  }

  const handleCreateMap = async (values: CreateMapFormValues) => {
    setCreateError(null)

    try {
      const createdMapId = await createMapMutation.mutateAsync({
        description: values.description,
        name: values.name,
      })

      setIsCreateModalOpen(false)
      navigate(`/app/map/${createdMapId}`)
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create map."
      )
    }
  }

  const handleUpdateMapDetails = async (values: MapDetailsFormValues) => {
    if (!selectedMapForDetails) {
      return
    }

    setDetailsError(null)

    try {
      await updateMapDetailsMutation.mutateAsync({
        description: values.description,
        mapId: selectedMapForDetails.id,
        name: values.name,
      })
      setSelectedMapForDetails(null)
    } catch (error) {
      setDetailsError(
        error instanceof Error ? error.message : "Failed to update map."
      )
    }
  }

  const handleRemoveMap = async () => {
    if (!selectedMapForRemoval) {
      return
    }

    setRemovalError(null)

    try {
      if (selectedMapForRemoval.ownerId === userId) {
        await deleteMapMutation.mutateAsync(selectedMapForRemoval.id)
      } else {
        await leaveMapMutation.mutateAsync(selectedMapForRemoval.id)
      }

      setSelectedMapForRemoval(null)
    } catch (error) {
      setRemovalError(
        error instanceof Error ? error.message : "Failed to update map access."
      )
    }
  }

  const handleJoinMap = async (values: JoinMapFormValues) => {
    setJoinError(null)
    setJoinInfoMessage(null)

    try {
      const result = await joinMapMutation.mutateAsync({
        mapId: values.mapId,
        mapName: values.mapName,
      })

      if (result === "already-member") {
        setJoinInfoMessage("You are already a member of this map.")
        return
      }

      setIsJoinModalOpen(false)
      navigate(`/app/map/${values.mapId.trim()}`)
    } catch (error) {
      if (error instanceof JoinMapFlowError) {
        setJoinError(error.message)
        return
      }

      setJoinError(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred while joining the map."
      )
    }
  }

  const handleRetryLoadingMaps = async () => {
    await mapsQuery.refetch()
  }

  const clearSearch = () => {
    setSearchTerm("")
  }

  return (
    <section className="space-y-5">
      <div className="animate-fade-up relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm md:p-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-soft/80 via-transparent to-card" />
        <div className="pointer-events-none absolute -right-16 top-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
                Dashboard
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                Your maps
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Create a map, reopen a workspace, or join one shared with your
                group.
              </p>
            </div>

            <div className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
              {accessibleMaps.length}{" "}
              {accessibleMaps.length === 1 ? "map" : "maps"} in your workspace
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openJoinModal} variant="outline">
              <Users className="size-4" />
              Join map
            </Button>
            <Button data-testid="create-map-btn" onClick={openCreateModal}>
              <Plus className="size-4" />
              New map
            </Button>
          </div>
        </div>
      </div>

      <Card className="animate-fade-up border-border/70 bg-card/95 shadow-md">
        <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-5 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base md:text-lg">All maps</CardTitle>
            <p className="text-sm text-muted-foreground">
              {accessibleMaps.length}{" "}
              {accessibleMaps.length === 1 ? "map" : "maps"} in your workspace
            </p>
          </div>

          <div className="relative w-full md:max-w-xl lg:max-w-2xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search maps by name..."
              value={searchTerm}
            />
          </div>
        </CardHeader>

        <CardContent className="p-4 md:p-5">
          {mapsQuery.isLoading ? <LoadingRows /> : null}

          {mapsQuery.isError ? (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-5 py-6">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex size-8 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertCircle className="size-4" />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-medium text-destructive">
                    {mapsQuery.error instanceof Error
                      ? mapsQuery.error.message
                      : "Failed to load maps."}
                  </p>
                  <Button
                    onClick={handleRetryLoadingMaps}
                    size="sm"
                    variant="outline"
                  >
                    Retry loading maps
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {hasNoMaps ? (
            <div className="rounded-2xl border border-dashed border-[hsl(var(--info-border))] bg-[hsl(var(--info-soft))] px-5 py-10 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-background/80 text-[hsl(var(--info-foreground))]">
                <FolderKanban className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                No maps yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Start your first map or join one shared by your group to begin
                building.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Button onClick={openCreateModal} size="sm">
                  <Plus className="size-4" />
                  New map
                </Button>
                <Button onClick={openJoinModal} size="sm" variant="outline">
                  <Users className="size-4" />
                  Join map
                </Button>
              </div>
            </div>
          ) : null}

          {hasNoSearchResults ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/45 px-5 py-10 text-center">
              <div className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-card text-muted-foreground">
                <FileSearch className="size-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">
                No results for "{searchTerm.trim()}"
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Try another search term or clear the filter to see all maps.
              </p>
              <div className="mt-5">
                <Button onClick={clearSearch} size="sm" variant="outline">
                  Clear search
                </Button>
              </div>
            </div>
          ) : null}

          {!mapsQuery.isLoading &&
          !mapsQuery.isError &&
          !hasNoMaps &&
          !hasNoSearchResults ? (
            <MapsList
              currentUserId={userId}
              maps={filteredMaps}
              onEditMap={(map) => {
                setDetailsError(null)
                setSelectedMapForDetails(map)
              }}
              onOpenMap={handleOpenMap}
              onRemoveMap={(map) => {
                setRemovalError(null)
                setSelectedMapForRemoval(map)
              }}
            />
          ) : null}
        </CardContent>
      </Card>

      <CreateMapModal
        errorMessage={createError}
        isSubmitting={createMapMutation.isPending}
        key={isCreateModalOpen ? "create-open" : "create-closed"}
        onClose={closeCreateModal}
        onSubmit={handleCreateMap}
        open={isCreateModalOpen}
      />
      <JoinMapModal
        errorMessage={joinError}
        infoMessage={joinInfoMessage}
        isSubmitting={joinMapMutation.isPending}
        key={isJoinModalOpen ? "join-open" : "join-closed"}
        onClose={closeJoinModal}
        onSubmit={handleJoinMap}
        open={isJoinModalOpen}
      />
      {selectedMapForDetails ? (
        <MapDetailsModal
          description="Update the name and description people see across the workspace."
          errorMessage={detailsError}
          initialDescription={selectedMapForDetails.description}
          initialName={selectedMapForDetails.name}
          isSubmitting={updateMapDetailsMutation.isPending}
          onClose={closeDetailsModal}
          onSubmit={handleUpdateMapDetails}
          open
          title="Edit map details"
        />
      ) : null}
      <ModalFrame
        description={
          selectedMapForRemoval?.ownerId === userId
            ? "This removes the map for everyone."
            : "This removes the shared map from your workspace."
        }
        onClose={closeRemovalModal}
        open={Boolean(selectedMapForRemoval)}
        title={selectedMapForRemoval?.ownerId === userId ? "Delete map" : "Leave map"}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card/95 px-3 py-3">
            <p className="text-sm font-medium text-foreground">
              {selectedMapForRemoval?.name ?? "Selected map"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedMapForRemoval?.ownerId === userId
                ? "Deleting a map also removes its nodes, connections, and shared access."
                : "You can rejoin later if someone shares the invite details again."}
            </p>
          </div>

          {removalError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {removalError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeRemovalModal} type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={deleteMapMutation.isPending || leaveMapMutation.isPending}
              onClick={handleRemoveMap}
              type="button"
              variant={selectedMapForRemoval?.ownerId === userId ? "destructive" : "outline"}
            >
              {selectedMapForRemoval?.ownerId === userId ? (
                <Trash2 className="size-4" />
              ) : (
                <LogOut className="size-4" />
              )}
              {deleteMapMutation.isPending || leaveMapMutation.isPending
                ? "Working..."
                : selectedMapForRemoval?.ownerId === userId
                  ? "Delete map"
                  : "Leave map"}
            </Button>
          </div>
        </div>
      </ModalFrame>
    </section>
  )
}
