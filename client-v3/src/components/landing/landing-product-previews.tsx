import { useTheme } from "@/components/theme/theme-provider"

import dashboardDark from "@/assets/landing/landing-dashboard-dark.png"
import dashboardLight from "@/assets/landing/landing-dashboard-light.png"
import workspaceDark from "@/assets/landing/landing-workspace-dark.png"
import workspaceLight from "@/assets/landing/landing-workspace-light.png"

/**
 * Real product screenshot of the map workspace.
 * Wraps the screenshot in a minimal chrome that matches the page's card style.
 */
export function LandingWorkspacePreview() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const src = isDark ? workspaceDark : workspaceLight

  return (
    <div
      aria-label="Branchly map workspace — canvas, navigator, and inspector"
      className="overflow-hidden rounded-[1.3rem] border border-border/70 bg-background text-left"
      role="img"
    >
      <img
        alt="Branchly map workspace showing a branching idea map with nodes, a navigator panel, and an inspector panel"
        className="block w-full"
        draggable={false}
        src={src}
      />
    </div>
  )
}

/**
 * Real product screenshot of the map library dashboard.
 */
export function LandingDashboardPreview() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const src = isDark ? dashboardDark : dashboardLight

  return (
    <div
      aria-label="Branchly map library — find and open your maps"
      className="overflow-hidden rounded-[1.15rem] border border-border/70 bg-background text-left"
      role="img"
    >
      <img
        alt="Branchly dashboard showing a map library with recent projects, search, and team role indicators"
        className="block w-full"
        draggable={false}
        src={src}
      />
    </div>
  )
}
