import { ArrowRight, Clock3, LogOut, Map, PencilLine, Trash2 } from "lucide-react"

import type { AccessibleMap } from "@/features/maps/types/maps-types"
import { cn } from "@/lib/utils"

type MapsListProps = {
  currentUserId: string | undefined
  maps: AccessibleMap[]
  onEditMap: (map: AccessibleMap) => void
  onOpenMap: (mapId: string) => void
  onRemoveMap: (map: AccessibleMap) => void
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

function getLastEditedLabel(lastEdited: string | null) {
  if (!lastEdited) {
    return "Not edited yet"
  }

  const parsedDate = new Date(lastEdited)
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not edited yet"
  }

  const formattedDate = parsedDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

  return `Updated ${formattedDate}`
}

function canEditMapDetails(map: AccessibleMap) {
  const role = map.role.trim().toLowerCase()
  return role === "admin" || role === "editor"
}

function fallbackDescription(map: AccessibleMap) {
  if (map.description.trim()) {
    return map.description.trim()
  }

  if (map.role === "viewer") {
    return "Shared workspace ready to review."
  }

  return "Add a description so collaborators know what this map is for."
}

export function MapsList({
  currentUserId,
  maps,
  onEditMap,
  onOpenMap,
  onRemoveMap,
}: MapsListProps) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2" role="list">
        {maps.map((map) => {
          const description = fallbackDescription(map)
          const isOwner = Boolean(currentUserId && map.ownerId === currentUserId)
          const canManageDetails = canEditMapDetails(map)

          return (
            <li key={map.id}>
              <div className="group flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-soft/20 hover:shadow-sm md:items-center md:px-4 md:py-3.5">
                <button
                  className="flex min-w-0 flex-1 items-start gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:gap-4"
                  onClick={() => onOpenMap(map.id)}
                  type="button"
                >
                  <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary-soft/55 text-primary shadow-sm transition-colors group-hover:bg-primary-soft md:size-10 md:rounded-2xl">
                    <Map className="size-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                      {map.name}
                    </p>
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground/70">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                          roleClassName(map.role)
                        )}
                      >
                        {formatRole(map.role)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3" />
                        {getLastEditedLabel(map.lastEdited)}
                      </span>
                    </div>
                  </div>

                  <ArrowRight className="mt-2 hidden size-4 shrink-0 text-muted-foreground/45 transition-all group-hover:translate-x-0.5 group-hover:text-foreground md:mt-0 md:block" />
                </button>

                <div className="flex shrink-0 items-center gap-1">
                  {canManageDetails ? (
                    <button
                      aria-label={`Rename ${map.name}`}
                      className="inline-flex size-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border/80 hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => onEditMap(map)}
                      title="Rename map"
                      type="button"
                    >
                      <PencilLine className="size-4" />
                    </button>
                  ) : null}
                  <button
                    aria-label={`${isOwner ? "Delete" : "Leave"} ${map.name}`}
                    className={cn(
                      "inline-flex size-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border/80 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isOwner
                        ? "hover:text-destructive"
                        : "hover:text-foreground"
                    )}
                    onClick={() => onRemoveMap(map)}
                    title={isOwner ? "Delete map" : "Leave map"}
                    type="button"
                  >
                    {isOwner ? (
                      <Trash2 className="size-4" />
                    ) : (
                      <LogOut className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
