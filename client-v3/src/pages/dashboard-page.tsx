import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Clock3,
  FileSearch,
  FolderKanban,
  LogOut,
  Pin,
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
  loadMapDashboardPreferences,
  pruneMapDashboardPreferences,
  recordRecentMapOpen,
  saveMapDashboardPreferences,
  type MapDashboardPreferences,
} from "@/features/maps/api/map-dashboard-preferences"
import {
  getBuiltInMapTemplate,
  instantiateMapTemplateGraph,
} from "@/features/maps/api/map-presets"
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
  useCreateSeededMapMutation,
  useDeleteMapMutation,
  useJoinMapMutation,
  useLeaveMapMutation,
  useUpdateMapDetailsMutation,
} from "@/features/maps/hooks/use-maps"
import {
  type AccessibleMap,
  JoinMapFlowError,
} from "@/features/maps/types/maps-types"
import { cn } from "@/lib/utils"

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

function SectionLoadingGrid() {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          className="animate-pulse rounded-2xl border border-border/70 bg-card/85 p-5"
          key={index}
        >
          <div className="h-4 w-28 rounded bg-muted/80" />
          <div className="mt-2 h-3 w-56 rounded bg-muted/70" />
          <div className="mt-4 space-y-2">
            <div className="h-14 rounded-xl bg-muted/70" />
            <div className="h-14 rounded-xl bg-muted/70" />
            <div className="h-14 rounded-xl bg-muted/70" />
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

function formatRole(role: string) {
  if (role === "admin" || role === "editor" || role === "viewer") {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return "Member"
}

function roleClassName(role: string) {
  if (role === "admin") {
    return "border-primary/25 bg-primary-soft text-primary"
  }

  if (role === "editor") {
    return "border-[hsl(var(--info-border))] bg-[hsl(var(--info-soft))] text-[hsl(var(--info-foreground))]"
  }

  return "border-border/80 bg-muted/70 text-muted-foreground"
}

function getOwnerContext(map: AccessibleMap, currentUserId: string | undefined) {
  if (map.ownerId && currentUserId && map.ownerId === currentUserId) {
    return "Owned by you"
  }

  if (map.ownerName) {
    return `Shared by ${map.ownerName}`
  }

  return "Shared workspace"
}

function getUpdatedSignal(lastEdited: string | null) {
  if (!lastEdited) {
    return "No edits yet"
  }

  const parsedDate = new Date(lastEdited)
  if (Number.isNaN(parsedDate.getTime())) {
    return "No edits yet"
  }

  const now = new Date()
  const todayKey = now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const mapDayKey = parsedDate.toDateString()

  if (mapDayKey === todayKey) {
    return `Updated today at ${parsedDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`
  }

  if (mapDayKey === yesterday.toDateString()) {
    return `Updated yesterday at ${parsedDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    })}`
  }

  return `Updated ${parsedDate.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })}`
}

function sameIdOrder(firstIds: string[], secondIds: string[]) {
  if (firstIds.length !== secondIds.length) {
    return false
  }

  return firstIds.every((id, index) => secondIds[index] === id)
}

type DashboardMapSectionProps = {
  currentUserId: string | undefined
  description: string
  emptyMessage: string
  keyId: string
  maps: AccessibleMap[]
  onOpenMap: (mapId: string) => void
  onTogglePin: (mapId: string) => void
  pinnedMapIds: Set<string>
  title: string
}

function DashboardMapSection({
  currentUserId,
  description,
  emptyMessage,
  keyId,
  maps,
  onOpenMap,
  onTogglePin,
  pinnedMapIds,
  title,
}: DashboardMapSectionProps) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm" data-section={keyId}>
      <CardHeader className="space-y-1 border-b border-border/70 pb-4">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="p-4">
        {maps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ) : (
          <ul className="space-y-2" role="list">
            {maps.map((map) => {
              const isPinned = pinnedMapIds.has(map.id)

              return (
                <li key={map.id}>
                  <div
                    className={cn(
                      "flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors hover:border-primary/30 hover:bg-primary-soft/15",
                      isPinned
                        ? "border-primary/30 bg-primary-soft/10"
                        : "border-border/70 bg-background/70"
                    )}
                  >
                    <button
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      onClick={() => onOpenMap(map.id)}
                      type="button"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {map.name}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            roleClassName(map.role)
                          )}
                        >
                          {formatRole(map.role)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground/85">
                        {getOwnerContext(map, currentUserId)}
                      </p>
                      <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="size-3" />
                        {getUpdatedSignal(map.lastEdited)}
                      </p>
                    </button>

                    <button
                      aria-label={`${isPinned ? "Unpin" : "Pin"} ${map.name}`}
                      className={cn(
                        "inline-flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        isPinned
                          ? "border-primary/20 bg-primary-soft/30 text-primary hover:bg-primary-soft/45"
                          : "border-transparent text-muted-foreground hover:border-border/80 hover:bg-background hover:text-foreground"
                      )}
                      onClick={() => onTogglePin(map.id)}
                      title={isPinned ? "Unpin map" : "Pin map"}
                      type="button"
                    >
                      <Pin className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const userId = user?.id

  const [searchTerm, setSearchTerm] = useState("")
  const [dashboardPreferences, setDashboardPreferences] =
    useState<MapDashboardPreferences>(() => loadMapDashboardPreferences(userId))
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
  const createSeededMapMutation = useCreateSeededMapMutation(userId)
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

  useEffect(() => {
    setDashboardPreferences(loadMapDashboardPreferences(userId))
  }, [userId])

  useEffect(() => {
    if (!userId || maps === undefined) {
      return
    }

    const accessibleMapIds = accessibleMaps.map((map) => map.id)
    const nextPreferences = pruneMapDashboardPreferences(
      dashboardPreferences,
      accessibleMapIds
    )

    if (
      sameIdOrder(nextPreferences.pinnedMapIds, dashboardPreferences.pinnedMapIds) &&
      sameIdOrder(nextPreferences.recentMapIds, dashboardPreferences.recentMapIds)
    ) {
      return
    }

    setDashboardPreferences(nextPreferences)
    saveMapDashboardPreferences(userId, nextPreferences)
  }, [accessibleMaps, dashboardPreferences, maps, userId])

  const pinnedMapIds = useMemo(
    () => new Set(dashboardPreferences.pinnedMapIds),
    [dashboardPreferences.pinnedMapIds]
  )
  const mapsById = useMemo(
    () => new Map(accessibleMaps.map((map) => [map.id, map])),
    [accessibleMaps]
  )

  const filteredMaps = useMemo(() => {
    if (!normalizedSearchTerm) {
      return accessibleMaps
    }

    return accessibleMaps.filter((map) =>
      map.name.toLowerCase().includes(normalizedSearchTerm)
    )
  }, [accessibleMaps, normalizedSearchTerm])

  const pinnedMaps = useMemo(
    () =>
      dashboardPreferences.pinnedMapIds
        .map((mapId) => mapsById.get(mapId))
        .filter((map): map is AccessibleMap => Boolean(map))
        .slice(0, 4),
    [dashboardPreferences.pinnedMapIds, mapsById]
  )
  const recentMaps = useMemo(
    () =>
      dashboardPreferences.recentMapIds
        .map((mapId) => mapsById.get(mapId))
        .filter((map): map is AccessibleMap => Boolean(map))
        .slice(0, 4),
    [dashboardPreferences.recentMapIds, mapsById]
  )
  const sharedWithMeMaps = useMemo(
    () =>
      accessibleMaps
        .filter((map) => !userId || map.ownerId !== userId)
        .slice(0, 4),
    [accessibleMaps, userId]
  )
  const recentlyUpdatedMaps = useMemo(() => {
    const recentAndPinnedIds = new Set([
      ...dashboardPreferences.pinnedMapIds,
      ...dashboardPreferences.recentMapIds,
    ])

    const sectionMaps = accessibleMaps.filter((map) => !recentAndPinnedIds.has(map.id))
    return (sectionMaps.length > 0 ? sectionMaps : accessibleMaps).slice(0, 4)
  }, [accessibleMaps, dashboardPreferences.pinnedMapIds, dashboardPreferences.recentMapIds])

  const hasNoMaps =
    !mapsQuery.isLoading &&
    !mapsQuery.isError &&
    accessibleMaps.length === 0
  const hasNoSearchResults =
    !mapsQuery.isLoading &&
    !mapsQuery.isError &&
    accessibleMaps.length > 0 &&
    filteredMaps.length === 0
  const dashboardSections = [
    {
      description: "Maps you opened most recently on this device.",
      emptyMessage: "Open a map and it will appear here for faster return-to-work.",
      keyId: "recent",
      maps: recentMaps,
      title: "Recent",
    },
    {
      description: "Keep important maps pinned for one-click return.",
      emptyMessage: "Pin a map from any dashboard card or list row to keep it here.",
      keyId: "pinned",
      maps: pinnedMaps,
      title: "Pinned",
    },
    {
      description: "Maps owned by collaborators and shared into your workspace.",
      emptyMessage: "When someone shares a map with you, it will show up here.",
      keyId: "shared",
      maps: sharedWithMeMaps,
      title: "Shared with me",
    },
    {
      description: "Maps with the freshest edits across your workspace.",
      emptyMessage: "Edits will surface here as your workspace changes.",
      keyId: "recently-updated",
      maps: recentlyUpdatedMaps,
      title: "Recently updated",
    },
  ]
  const mobileDashboardSections = dashboardSections.filter(
    (section) => section.maps.length > 0
  )

  const openCreateModal = () => {
    setCreateError(null)
    setIsCreateModalOpen(true)
  }

  const closeCreateModal = () => {
    if (createMapMutation.isPending || createSeededMapMutation.isPending) {
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

  const handleTogglePin = (mapId: string) => {
    setDashboardPreferences((currentPreferences) => {
      const isPinned = currentPreferences.pinnedMapIds.includes(mapId)
      const nextPreferences = {
        ...currentPreferences,
        pinnedMapIds: isPinned
          ? currentPreferences.pinnedMapIds.filter((id) => id !== mapId)
          : [mapId, ...currentPreferences.pinnedMapIds.filter((id) => id !== mapId)],
      } satisfies MapDashboardPreferences

      saveMapDashboardPreferences(userId, nextPreferences)
      return nextPreferences
    })
  }

  const handleOpenMap = (mapId: string) => {
    const nextPreferences = recordRecentMapOpen(userId, mapId)
    setDashboardPreferences((currentPreferences) => ({
      pinnedMapIds: currentPreferences.pinnedMapIds,
      recentMapIds: nextPreferences.recentMapIds,
    }))
    navigate(`/app/map/${mapId}`)
  }

  const handleCreateMap = async (values: CreateMapFormValues) => {
    setCreateError(null)

    try {
      const createdMapId = values.templateId
        ? await (async () => {
            const template = getBuiltInMapTemplate(values.templateId ?? "")
            if (!template) {
              throw new Error("The selected template is no longer available.")
            }

            const graph = instantiateMapTemplateGraph(template)
            return createSeededMapMutation.mutateAsync({
              description: values.description,
              edges: graph.edges,
              name: values.name,
              nodes: graph.nodes,
            })
          })()
        : await createMapMutation.mutateAsync({
            description: values.description,
            name: values.name,
          })

      setIsCreateModalOpen(false)
      handleOpenMap(createdMapId)
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
      handleOpenMap(values.mapId.trim())
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
                Pick up where you left off
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Jump into recent, pinned, shared, and freshly updated maps without
                digging through the full workspace list.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1">
                {accessibleMaps.length} {accessibleMaps.length === 1 ? "map" : "maps"} in
                your workspace
              </span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1">
                {dashboardPreferences.pinnedMapIds.length} pinned
              </span>
              <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-3 py-1">
                {sharedWithMeMaps.length} shared with you
              </span>
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

      {mapsQuery.isLoading ? <SectionLoadingGrid /> : null}

      {!mapsQuery.isLoading && !mapsQuery.isError && !hasNoMaps ? (
        <>
          <div className="grid gap-4 md:hidden">
            {mobileDashboardSections.map((section) => (
              <DashboardMapSection
                currentUserId={userId}
                description={section.description}
                emptyMessage={section.emptyMessage}
                key={section.keyId}
                keyId={section.keyId}
                maps={section.maps}
                onOpenMap={handleOpenMap}
                onTogglePin={handleTogglePin}
                pinnedMapIds={pinnedMapIds}
                title={section.title}
              />
            ))}
          </div>

          <div className="hidden gap-4 md:grid xl:grid-cols-2">
            {dashboardSections.map((section) => (
              <DashboardMapSection
                currentUserId={userId}
                description={section.description}
                emptyMessage={section.emptyMessage}
                key={section.keyId}
                keyId={section.keyId}
                maps={section.maps}
                onOpenMap={handleOpenMap}
                onTogglePin={handleTogglePin}
                pinnedMapIds={pinnedMapIds}
                title={section.title}
              />
            ))}
          </div>
        </>
      ) : null}

      <Card className="animate-fade-up border-border/70 bg-card/95 shadow-md">
        <CardHeader className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base md:text-lg">All maps</CardTitle>
            <p className="text-sm text-muted-foreground">
              {normalizedSearchTerm
                ? `${filteredMaps.length} of ${accessibleMaps.length} ${accessibleMaps.length === 1 ? "map" : "maps"}`
                : `${accessibleMaps.length} ${accessibleMaps.length === 1 ? "map" : "maps"} in your workspace`}
            </p>
          </div>

          <div className="relative w-full lg:max-w-2xl">
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
              onTogglePin={handleTogglePin}
              pinnedMapIds={pinnedMapIds}
            />
          ) : null}
        </CardContent>
      </Card>

      <CreateMapModal
        errorMessage={createError}
        isSubmitting={
          createMapMutation.isPending || createSeededMapMutation.isPending
        }
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
