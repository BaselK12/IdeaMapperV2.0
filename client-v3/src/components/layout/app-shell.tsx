import { LayoutDashboard, Menu, Network, Settings, Sparkles } from "lucide-react"
import { NavLink, Outlet } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/store/ui-store"

const links = [
  { icon: LayoutDashboard, label: "Overview", to: "/" },
  { icon: Network, label: "Maps", to: "/maps" },
  { icon: Settings, label: "Settings", to: "/settings" },
]

export function AppShell() {
  const isSidebarOpen = useUiStore((state) => state.isSidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)
  const toggleSidebar = useUiStore((state) => state.toggleSidebar)

  return (
    <div className="relative min-h-screen bg-slate-100/70">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.10),transparent_45%),radial-gradient(circle_at_80%_0%,rgba(16,185,129,0.10),transparent_38%),linear-gradient(to_bottom,rgba(248,250,252,0.95),rgba(241,245,249,0.9))]" />

      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 md:px-6">
          <Button
            aria-label="Toggle sidebar"
            className="md:hidden"
            onClick={toggleSidebar}
            size="icon"
            variant="outline"
          >
            <Menu className="size-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="grid size-8 place-content-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="size-4" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">ideaMapper V3</p>
              <p className="text-xs text-muted-foreground">Foundation shell</p>
            </div>
          </div>
          <p className="ml-auto text-xs font-medium text-muted-foreground">
            React + Vite + TypeScript
          </p>
        </div>
      </header>

      {isSidebarOpen ? (
        <button
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-10 bg-slate-900/20 md:hidden"
          onClick={closeSidebar}
          type="button"
        />
      ) : null}

      <div className="mx-auto grid max-w-screen-2xl md:grid-cols-[250px_1fr]">
        <aside
          className={cn(
            "fixed inset-y-16 left-0 z-20 w-64 border-r bg-background px-3 py-4 transition-transform duration-200 md:static md:z-0 md:w-auto md:translate-x-0",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <nav className="space-y-1">
            {links.map(({ icon: Icon, label, to }) => (
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-accent text-accent-foreground"
                  )
                }
                key={to}
                onClick={closeSidebar}
                to={to}
              >
                <Icon className="size-4" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>
          <Separator className="my-4" />
          <Card className="border-dashed bg-slate-50/70 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Sidebar Placeholder</CardTitle>
              <CardDescription className="text-xs">
                Teams, spaces, and filters can live here.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
              This is intentionally lightweight for the V3 foundation.
            </CardContent>
          </Card>
        </aside>
        <main className="min-h-[calc(100vh-4rem)] p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
