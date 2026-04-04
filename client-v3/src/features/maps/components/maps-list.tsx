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

function formatLastEdited(lastEdited: string | null) {
  if (!lastEdited) {
    return "No edits yet"
  }

  const parsedDate = new Date(lastEdited)
  if (Number.isNaN(parsedDate.getTime())) {
    return "No edits yet"
  }

  return parsedDate.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

function shortId(id: string) {
  if (id.length <= 10) {
    return id
  }

  return `${id.slice(0, 8)}...${id.slice(-4)}`
}

export function MapsList({ maps, onOpenMap }: MapsListProps) {
  return (
    <div className="space-y-2">
      <ul className="space-y-2" role="list">
        {maps.map((map) => (
          <li key={map.id}>
            <button
              className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3.5 text-left transition-all hover:border-primary/30 hover:bg-primary-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-4 md:py-4"
              onClick={() => onOpenMap(map.id)}
              type="button"
            >
              <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background text-primary/85">
                <Map className="size-4" />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-base font-semibold tracking-tight text-foreground">
                  {map.name}
                </p>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {map.description || "No description provided."}
                </p>
                <p className="hidden text-[10px] uppercase tracking-[0.14em] text-muted-foreground/65 sm:block">
                  ID {shortId(map.id)}
                </p>
              </div>

              <div className="hidden min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground/75 md:flex">
                <Clock3 className="size-3.5" />
                Updated {formatLastEdited(map.lastEdited)}
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                    roleClassName(map.role)
                  )}
                >
                  {formatRole(map.role)}
                </span>
                <ArrowRight className="size-4 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
