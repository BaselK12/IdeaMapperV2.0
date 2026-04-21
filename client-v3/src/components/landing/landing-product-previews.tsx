import {
  CalendarClock,
  CircleDot,
  Clock3,
  Map,
  Plus,
  Search,
  Sparkles,
  Users2,
} from "lucide-react"

import { cn } from "@/lib/utils"

const workspaceNodes = [
  {
    className:
      "left-[36%] top-[38%] w-[13rem] border-primary/45 bg-primary-soft/95 shadow-lg",
    eyebrow: "Central idea",
    title: "Science Fair Launch",
  },
  {
    className: "left-[10%] top-[18%] w-[11rem] border-border/80 bg-card/95",
    eyebrow: "Research",
    title: "Research question",
  },
  {
    className: "right-[9%] top-[18%] w-[11rem] border-border/80 bg-card/95",
    eyebrow: "Build",
    title: "Experiment design",
  },
  {
    className: "left-[16%] bottom-[18%] w-[11rem] border-border/80 bg-card/95",
    eyebrow: "Track",
    title: "Data table",
  },
  {
    className: "right-[12%] bottom-[16%] w-[12rem] border-border/80 bg-card/95",
    eyebrow: "Share",
    title: "Presentation story",
  },
]

const workspaceEdges = [
  "left-[28%] top-[33%] w-[18%] rotate-[22deg]",
  "right-[28%] top-[33%] w-[18%] -rotate-[22deg]",
  "left-[30%] bottom-[32%] w-[18%] -rotate-[28deg]",
  "right-[30%] bottom-[32%] w-[18%] rotate-[28deg]",
]

const navigatorNodes = [
  "Science Fair Launch",
  "Research question",
  "Experiment design",
  "Data table",
  "Presentation story",
]

const dashboardMaps = [
  {
    description: "Hypothesis, tasks, and presentation milestones for the team.",
    role: "Admin",
    title: "Science Fair Launch",
    updated: "Updated Apr 18, 2026",
  },
  {
    description: "Arguments, sources, and speaking order for debate practice.",
    role: "Editor",
    title: "History Debate Prep",
    updated: "Updated Apr 16, 2026",
  },
  {
    description: "Feature ideas, build steps, and testing notes for the robot.",
    role: "Viewer",
    title: "Robotics Club Roadmap",
    updated: "Updated Apr 12, 2026",
  },
]

export function LandingWorkspacePreview() {
  return (
    <div
      aria-label="Branchly workspace preview with a polished science fair map, live status, navigator, canvas, and inspector."
      className="overflow-hidden rounded-[1.3rem] border border-border/70 bg-background text-left"
      role="img"
    >
      <div className="border-b border-border/70 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Science Fair Launch
            </p>
            <p className="text-xs text-muted-foreground">
              Plan the project, assign work, and prepare the final presentation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-2.5 py-1 font-medium text-[hsl(var(--success-foreground))]">
              Saved
            </span>
            <span className="rounded-full border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-2.5 py-1 font-medium text-[hsl(var(--success-foreground))]">
              Realtime live
            </span>
          </div>
        </div>
      </div>

      <div className="grid min-h-[26rem] md:grid-cols-[180px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)_210px]">
        <aside className="hidden border-r border-border/70 bg-card/70 p-4 md:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Navigator
          </p>
          <div className="mt-3 flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-xs text-muted-foreground shadow-sm">
            <Search className="size-3.5" />
            Search nodes
          </div>
          <ul className="mt-4 space-y-1.5">
            {navigatorNodes.map((node, index) => (
              <li key={node}>
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs",
                    index === 0
                      ? "bg-primary-soft text-foreground"
                      : "text-muted-foreground"
                  )}
                >
                  <CircleDot className="size-3.5 text-primary" />
                  <span className="truncate">{node}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl border border-border/80 bg-card px-2.5 py-2">
              <p className="text-muted-foreground">Nodes</p>
              <p className="font-semibold text-foreground">5</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-card px-2.5 py-2">
              <p className="text-muted-foreground">Links</p>
              <p className="font-semibold text-foreground">4</p>
            </div>
          </div>
        </aside>

        <main className="bg-card/50 p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/80 bg-card px-2.5 py-1">
              Canvas
            </span>
            <span className="rounded-full border border-border/80 bg-card px-2.5 py-1">
              Admin access
            </span>
            <span className="rounded-full border border-border/80 bg-card px-2.5 py-1">
              Last edited Apr 18, 2026
            </span>
          </div>

          <div className="relative mt-3 min-h-[22rem] overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:18px_18px]">
            {workspaceEdges.map((edge) => (
              <span
                className={cn(
                  "absolute h-px origin-left rounded-full bg-primary/35",
                  edge
                )}
                key={edge}
              />
            ))}
            {workspaceNodes.map((node) => (
              <div
                className={cn(
                  "absolute rounded-2xl border px-4 py-3 shadow-sm",
                  node.className
                )}
                key={node.title}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {node.eyebrow}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">
                  {node.title}
                </p>
              </div>
            ))}
          </div>
        </main>

        <aside className="hidden border-l border-border/70 bg-card/70 p-4 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Inspector
          </p>
          <div className="mt-3 rounded-xl border border-border/80 bg-card p-3.5">
            <p className="text-sm font-medium text-foreground">Selected node</p>
            <div className="mt-3 space-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Title</p>
                <p className="mt-1 rounded-lg border border-border/80 bg-background px-3 py-2 font-medium text-foreground">
                  Science Fair Launch
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/80 bg-background px-2.5 py-2">
                  <p className="text-muted-foreground">Links</p>
                  <p className="font-medium text-foreground">4 connected</p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background px-2.5 py-2">
                  <p className="text-muted-foreground">Owner</p>
                  <p className="font-medium text-foreground">Team lead</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-2 rounded-xl border border-border/80 bg-card p-3.5 text-xs">
            <p className="inline-flex items-center gap-2 font-medium text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Map details
            </p>
            <p className="text-muted-foreground">
              Project plan for the research question, experiment work, and final
              presentation.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export function LandingDashboardPreview() {
  return (
    <div
      aria-label="Branchly dashboard preview showing clean map cards without raw IDs or placeholder descriptions."
      className="overflow-hidden rounded-[1.15rem] border border-border/70 bg-background text-left"
      role="img"
    >
      <div className="border-b border-border/70 bg-primary-soft/35 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="size-3.5" />
              Dashboard
            </p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              Your maps
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Open recent projects, start a new map, or join one from your team.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-md border border-border/80 bg-background px-3 py-2 text-xs font-medium text-foreground shadow-sm">
              <Users2 className="size-3.5" />
              Join Map
            </span>
            <span className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground shadow-sm">
              <Plus className="size-3.5" />
              New Map
            </span>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex flex-col gap-3 border-b border-border/70 pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">All maps</p>
            <p className="text-sm text-muted-foreground">
              3 maps in your workspace
            </p>
          </div>
          <div className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground shadow-sm md:max-w-sm">
            <Search className="size-4" />
            Search maps by name
          </div>
        </div>

        <ul className="mt-4 space-y-2.5">
          {dashboardMaps.map((map) => (
            <li
              className="rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm"
              key={map.title}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-primary-soft/55 text-primary">
                  <Map className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {map.title}
                  </p>
                  <p className="line-clamp-1 text-sm text-muted-foreground">
                    {map.description}
                  </p>
                </div>
                <div className="hidden min-w-[8.5rem] items-center justify-end gap-1.5 text-[11px] text-muted-foreground md:flex">
                  <Clock3 className="size-3.5" />
                  {map.updated}
                </div>
                <span className="rounded-full border border-primary/25 bg-primary-soft px-2.5 py-1 text-[10px] font-medium text-primary">
                  {map.role}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
