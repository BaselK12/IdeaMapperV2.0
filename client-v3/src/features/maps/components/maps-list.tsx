import { ArrowRight, Clock3, Map } from "lucide-react"

import type { AccessibleMap } from "@/features/maps/types/maps-types"
import { cn } from "@/lib/utils"

type MapsListProps = {
  maps: AccessibleMap[]
  onOpenMap: (mapId: string) => void
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

export function MapsList({ maps, onOpenMap }: MapsListProps) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2" role="list">
        {maps.map((map) => {
          const description = map.description?.trim()

          return (
            <li key={map.id}>
              <button
                className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary-soft/20 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-4 md:py-4"
                onClick={() => onOpenMap(map.id)}
                type="button"
              >
                <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary-soft/55 text-primary shadow-sm transition-colors group-hover:bg-primary-soft">
                  <Map className="size-4" />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate text-[15px] font-semibold tracking-tight text-foreground md:text-base">
                    {map.name}
                  </p>
                  {description ? (
                    <p className="line-clamp-1 text-sm text-muted-foreground">
                      {description}
                    </p>
                  ) : null}
                </div>

                <div className="hidden min-w-[9rem] items-center justify-end gap-1.5 text-[11px] text-muted-foreground/70 md:flex">
                  <Clock3 className="size-3.5" />
                  {getLastEditedLabel(map.lastEdited)}
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium",
                      roleClassName(map.role)
                    )}
                  >
                    {formatRole(map.role)}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground/55 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
