// DEMO-ONLY: Shows current demo plan and opens upgrade modal.
import { ArrowRight } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { PLAN_CONFIGS } from "@/lib/demo-plan"
import { cn } from "@/lib/utils"
import { useDemoPlan } from "./demo-plan-context"
import { UpgradeModal } from "./upgrade-modal"

/**
 * Compact plan section for the bottom of the sidebar account card.
 * Visual language matches the Settings → Plan card, scaled down for the sidebar.
 */
export function PlanBadge() {
  const { plan, planConfig } = useDemoPlan()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const isUpgradeable = plan !== "team"

  return (
    <>
      <div className="mt-2.5 space-y-2 border-t border-border/50 pt-2.5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
              plan === "free" && "bg-muted text-muted-foreground",
              plan === "pro" && "bg-primary/15 text-primary",
              plan === "team" && "bg-violet-500/15 text-violet-500"
            )}
          >
            {planConfig.label}
          </span>
          <span className="text-xs text-muted-foreground">Demo plan</span>
        </div>

        {isUpgradeable && (
          <Button
            className="h-7 gap-1.5 px-2.5 text-xs"
            onClick={() => setIsModalOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            Upgrade plan
            <ArrowRight className="size-3" />
          </Button>
        )}
      </div>

      <UpgradeModal
        highlightPlan={plan === "free" ? "pro" : "team"}
        onClose={() => setIsModalOpen(false)}
        open={isModalOpen}
      />
    </>
  )
}

// Standalone pill for use outside the account card (e.g. future contexts).
export function PlanBadgeInline() {
  const { plan } = useDemoPlan()
  const config = PLAN_CONFIGS[plan]

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
        plan === "free" && "bg-muted text-muted-foreground",
        plan === "pro" && "bg-primary/15 text-primary",
        plan === "team" && "bg-violet-500/15 text-violet-500"
      )}
    >
      {config.label}
    </span>
  )
}
