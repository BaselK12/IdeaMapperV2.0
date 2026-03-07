import { useMemo, useState } from "react"
import {
  ArrowLeft,
  CalendarClock,
  CircleDot,
  Download,
  LayoutList,
  MoreHorizontal,
  Search,
  Share2,
  Tag,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { MapWorkspace } from "@/features/map-workspace/types/map-workspace-types"
import { cn } from "@/lib/utils"

type MapWorkspaceShellProps = {
  map: MapWorkspace
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
    return "Not available"
  }

  const parsedDate = new Date(lastEdited)
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available"
  }

  return parsedDate.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function shortId(value: string) {
  if (value.length <= 12) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

const canvasGridStyle = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.55) 1px, transparent 0)",
  backgroundSize: "22px 22px",
}

export function MapWorkspaceShell({ map }: MapWorkspaceShellProps) {
  const [searchTerm, setSearchTerm] = useState("")

  const outlineItems = useMemo(() => {
    const baseItems = [
      "Overview lane",
      "Research cluster",
      "Priority tasks",
      "Review notes",
    ]

    if (map.description.trim()) {
      baseItems.unshift("Description draft")
    }

    const normalizedTerm = searchTerm.trim().toLowerCase()
    if (!normalizedTerm) {
      return baseItems
    }

    return baseItems.filter((item) => item.toLowerCase().includes(normalizedTerm))
  }, [map.description, searchTerm])

  return (
    <section className="animate-fade-up flex h-[calc(100vh-2rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg">
      <header className="space-y-4 border-b border-border/70 px-4 py-4 md:px-6 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/app">
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                roleClassName(map.role)
              )}
            >
              {formatRole(map.role)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline">
              <Share2 className="size-4" />
              Share
            </Button>
            <Button size="sm" variant="outline">
              <Download className="size-4" />
              Export
            </Button>
            <Button size="sm" variant="outline">
              <MoreHorizontal className="size-4" />
              More
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            {map.name}
          </h1>
          <p className="line-clamp-2 text-sm text-muted-foreground md:text-base">
            {map.description || "No description added yet for this map."}
          </p>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 rounded-2xl border border-border/70 bg-background/85 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Navigator
          </p>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search sections..."
              value={searchTerm}
            />
          </div>

          <div className="mt-4 space-y-2.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <LayoutList className="size-3.5" />
              Outline
            </p>
            <ul className="space-y-1.5">
              {outlineItems.length > 0 ? (
                outlineItems.map((item) => (
                  <li key={item}>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-foreground/90 transition-colors hover:bg-primary-soft/60"
                      type="button"
                    >
                      <CircleDot className="size-3.5 text-primary" />
                      <span>{item}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-xs text-muted-foreground">
                  No matching sections yet.
                </li>
              )}
            </ul>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Tag className="size-3.5" />
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {["Ideas", "Research", "Roadmap", "Review"].map((tag) => (
                <span
                  className="rounded-full border border-border/80 bg-card px-2.5 py-1 text-xs text-muted-foreground"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <main className="relative min-h-[360px] overflow-hidden rounded-2xl border border-border/70 bg-background/85">
          <div className="absolute inset-0" style={canvasGridStyle} />
          <div className="absolute inset-0 bg-gradient-to-b from-background/55 via-transparent to-background/70" />

          <div className="relative flex h-full flex-col p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                Canvas
              </span>
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                {formatRole(map.role)} access
              </span>
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                Last edited {formatLastEdited(map.lastEdited)}
              </span>
            </div>

            <div className="mt-auto max-w-xl rounded-2xl border border-border/80 bg-card/90 p-5 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Editor Canvas
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
                Workspace scaffold is ready
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This area is prepared for React Flow in the next PR. Node and edge
                rendering can plug directly into this canvas surface.
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <li>React Flow mount point and viewport controls</li>
                <li>Map nodes and edges loading pipeline</li>
                <li>Basic edit actions and selection state</li>
              </ul>
            </div>
          </div>
        </main>

        <aside className="min-h-0 rounded-2xl border border-border/70 bg-background/85 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Inspector
          </p>

          <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-card/75 p-3.5">
            <p className="text-sm font-medium text-foreground">No element selected</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select a node or edge in the canvas to inspect and edit details.
            </p>
          </div>

          <Separator className="my-4" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Map ID</span>
              <span className="font-medium text-foreground">{shortId(map.id)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium text-foreground">{formatRole(map.role)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last edited</span>
              <span className="font-medium text-foreground">
                {formatLastEdited(map.lastEdited)}
              </span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Description
            </p>
            <p className="rounded-xl border border-border/80 bg-card/75 px-3 py-2.5 text-xs text-muted-foreground">
              {map.description || "No description available yet."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
