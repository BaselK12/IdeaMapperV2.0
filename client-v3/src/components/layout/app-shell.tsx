import { useState } from "react"
import {
  Blocks,
  Home,
  LogOut,
  Settings,
  Share2,
} from "lucide-react"
import { NavLink, Outlet, useMatch, useNavigate } from "react-router-dom"

import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { cn } from "@/lib/utils"

const sidebarNav = [
  {
    icon: Home,
    kind: "link" as const,
    label: "Maps",
    to: "/app",
  },
  {
    icon: Share2,
    kind: "disabled" as const,
    label: "Shared",
  },
  {
    icon: Blocks,
    kind: "disabled" as const,
    label: "Templates",
  },
  {
    icon: Settings,
    kind: "link" as const,
    label: "Settings",
    to: "/app/settings",
  },
]

export function AppShell() {
  const navigate = useNavigate()
  const isMapWorkspaceRoute = Boolean(useMatch("/app/map/:mapId"))
  const { signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const accountName = user?.email?.split("@")[0] ?? "User"
  const accountEmail = user?.email ?? "Signed in"
  const accountInitial = (user?.email?.[0] ?? "U").toUpperCase()
  const mobileNavItems = sidebarNav.filter((item) => item.kind === "link")

  const handleSignOut = async () => {
    setSignOutError(null)
    setIsSigningOut(true)

    const { error } = await signOut()

    if (error) {
      setSignOutError(error)
      setIsSigningOut(false)
      return
    }

    navigate("/", { replace: true })
  }

  if (isMapWorkspaceRoute) {
    return (
      <div className="relative min-h-screen overflow-x-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
        <div className="pointer-events-none absolute -right-28 top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute left-0 top-52 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

        <div className="mx-auto flex min-h-screen w-full max-w-[1680px] flex-col px-2 py-2 sm:px-3 sm:py-3 md:px-5 md:py-5">
          <Outlet />
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -right-28 top-24 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute left-0 top-52 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-3 px-3 py-3 md:flex-row md:gap-6 md:px-6 md:py-6">
        <aside className="animate-fade-up hidden w-full flex-col rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)] md:w-72 md:p-4">
          <div className="rounded-xl bg-gradient-to-r from-primary-soft to-background p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              ideaMapper V3
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Collaborative workspace
            </p>
          </div>

          <nav aria-label="Workspace navigation" className="mt-4 grid gap-2">
            {sidebarNav.map((item) => {
              const Icon = item.icon
              const baseClassName =
                "group inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"

              if (item.kind === "link") {
                return (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        baseClassName,
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground/80 hover:bg-primary-soft hover:text-foreground"
                      )
                    }
                    end={item.to === "/app"}
                    key={item.label}
                    to={item.to}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              }

              return (
                <button
                  className={cn(
                    baseClassName,
                    "cursor-default text-muted-foreground/70 hover:bg-muted"
                  )}
                  disabled
                  key={item.label}
                  type="button"
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  <span className="ml-auto rounded-full border border-border/80 bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                </button>
              )
            })}
          </nav>

          <div className="mt-auto space-y-3 rounded-xl border border-border/70 bg-background/80 p-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {accountInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {accountName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {accountEmail}
                </p>
              </div>
            </div>

            {signOutError ? (
              <p className="text-xs text-destructive">{signOutError}</p>
            ) : null}

            <Button
              className="w-full justify-start"
              disabled={isSigningOut}
              onClick={handleSignOut}
              size="sm"
              variant="outline"
            >
              <LogOut className="size-4" />
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="animate-fade-up rounded-2xl border border-border/70 bg-card/90 px-3 py-3 shadow-sm md:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  ideaMapper V3
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                    {accountInitial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {accountName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {accountEmail}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="h-9 shrink-0 px-3"
                disabled={isSigningOut}
                onClick={handleSignOut}
                size="sm"
                variant="outline"
              >
                <LogOut className="size-4" />
                {isSigningOut ? "Signing out..." : "Sign out"}
              </Button>
            </div>

            {signOutError ? (
              <p className="mt-2 text-xs text-destructive">{signOutError}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Theme
              </p>
              <ThemeToggle />
            </div>

            <nav aria-label="Mobile workspace navigation" className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {mobileNavItems.map((item) => {
                const Icon = item.icon

                return (
                  <NavLink
                    className={({ isActive }) =>
                      cn(
                        "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary/30 bg-primary text-primary-foreground shadow-sm"
                          : "border-border/80 bg-background/80 text-foreground/80 hover:bg-primary-soft hover:text-foreground"
                      )
                    }
                    end={item.to === "/app"}
                    key={item.label}
                    to={item.to}
                  >
                    <Icon className="size-4" />
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <header className="animate-fade-up hidden rounded-2xl border border-border/70 bg-card/85 px-5 py-4 shadow-sm md:block md:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              Workspace
            </p>
            <div className="mt-2 flex items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                  Map Collaboration Hub
                </h1>
                <p className="text-sm text-muted-foreground">
                  Organize maps, invite participants, and continue your work.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <ThemeToggle className="shrink-0" />
                <div className="hidden items-center rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground xl:inline-flex">
                  <Settings className="mr-2 size-4 text-primary" />
                  V3 shell
                </div>
              </div>
            </div>
          </header>

          <main className="mt-3 min-h-0 flex-1 pb-10 md:mt-5">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
