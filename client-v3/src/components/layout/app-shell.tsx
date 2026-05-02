import { useState } from "react"
import {
  Home,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react"
import { NavLink, Outlet, useMatch, useNavigate } from "react-router-dom"

import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import { NotificationBell } from "@/features/notifications/components/notification-bell"
import { cn } from "@/lib/utils"

const sidebarNav = [
  {
    icon: Home,
    kind: "link" as const,
    label: "Maps",
    to: "/app",
  },
  {
    icon: Settings,
    kind: "link" as const,
    label: "Settings",
    to: "/app/settings",
  },
]

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getAccountName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) {
    return "User"
  }

  const metadata = user.user_metadata
  const metadataName =
    normalizeOptionalText(metadata?.full_name) ||
    normalizeOptionalText(metadata?.name) ||
    normalizeOptionalText(metadata?.username)

  return metadataName || user.email?.split("@")[0] || "User"
}

export function AppShell() {
  const navigate = useNavigate()
  const isDashboardRoute = Boolean(useMatch({ end: true, path: "/app" }))
  const isMapWorkspaceRoute = Boolean(useMatch("/app/map/:mapId"))
  const { signOut, user } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const accountName = getAccountName(user)
  const accountEmail = user?.email ?? "Signed in"
  const accountInitial = (accountName[0] ?? "U").toUpperCase()

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

      <div className="mx-auto flex min-h-screen w-full max-w-[1440px] flex-col gap-3 px-3 py-3 md:px-6 md:py-6 lg:flex-row lg:gap-6">
        <aside className="animate-fade-up hidden w-full flex-col rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm lg:sticky lg:top-6 lg:flex lg:w-[18rem] lg:self-start lg:p-4">
          <div className="rounded-xl border border-border/70 bg-background/80 p-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-10 place-content-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  Branchly
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Maps workspace
                </p>
              </div>
            </div>

            <div className="mt-3 flex justify-end">
              <ThemeToggle compact className="shrink-0" />
            </div>
          </div>

          <nav aria-label="Workspace navigation" className="mt-4 grid gap-1.5">
            {sidebarNav.map((item) => {
              const Icon = item.icon
              const baseClassName =
                "group inline-flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"

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
            })}
          </nav>

          <div className="mt-4 rounded-xl border border-border/70 bg-background/80 p-3">
            <div className="flex items-center gap-2">
              <div className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {accountInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {accountName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {accountEmail}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <NotificationBell user={user} />
                <Button
                  className="h-9 w-9 p-0"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  size="sm"
                  title={isSigningOut ? "Signing out..." : "Sign out"}
                  variant="outline"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>

            {signOutError ? (
              <p className="mt-3 text-xs text-destructive">{signOutError}</p>
            ) : null}
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="animate-fade-up rounded-2xl border border-border/70 bg-card/90 px-3 py-2.5 shadow-sm lg:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Branchly
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {accountEmail}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <ThemeToggle compact />
                <NotificationBell user={user} />
                <Button
                  aria-label={isSigningOut ? "Signing out" : "Sign out"}
                  className="size-9 shrink-0"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  size="sm"
                  title={isSigningOut ? "Signing out..." : "Sign out"}
                  variant="outline"
                >
                  <LogOut className="size-4" />
                </Button>
              </div>
            </div>

            {signOutError ? (
              <p className="mt-2 text-xs text-destructive">{signOutError}</p>
            ) : null}

            <nav aria-label="Mobile workspace navigation" className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
              {sidebarNav.map((item) => {
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

          <main
            className={cn(
              "min-h-0 flex-1 pb-10",
              !isDashboardRoute && "lg:pt-1"
            )}
          >
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
