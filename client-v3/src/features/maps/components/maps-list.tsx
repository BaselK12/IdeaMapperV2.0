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
    return "border-violet-300/70 bg-violet-100 text-violet-700"
  }

  if (role === "editor") {
    return "border-blue-300/70 bg-blue-100 text-blue-700"
  }

  return "border-slate-300/70 bg-slate-100 text-slate-700"
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
              className="group flex w-full items-center gap-4 rounded-xl border border-border/70 bg-card px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-primary-soft/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              onClick={() => onOpenMap(map.id)}
              type="button"
            >
              <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background text-primary">
                <Map className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground md:text-base">
                  {map.name}
                </p>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {map.description || "No description provided."}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground/85">
                  ID {shortId(map.id)}
                </p>
              </div>

              <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground md:flex">
                <Clock3 className="size-3.5" />
                Updated {formatLastEdited(map.lastEdited)}
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    roleClassName(map.role)
                  )}
                >
                  {formatRole(map.role)}
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
