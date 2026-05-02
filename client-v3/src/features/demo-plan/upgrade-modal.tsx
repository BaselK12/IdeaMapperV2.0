// DEMO-ONLY: Simulates plan selection without real billing.
import { ArrowRight, Check, Sparkles, X } from "lucide-react"
import { useState } from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { type DemoPlan, PLAN_CONFIGS } from "@/lib/demo-plan"
import { cn } from "@/lib/utils"
import { useDemoPlan } from "./demo-plan-context"

interface UpgradeModalProps {
  highlightPlan?: DemoPlan
  onClose: () => void
  open: boolean
}

const PLAN_ORDER: DemoPlan[] = ["free", "pro", "team"]

export function UpgradeModal({ highlightPlan = "pro", onClose, open }: UpgradeModalProps) {
  const { plan: currentPlan, setPlan } = useDemoPlan()
  const [confirming, setConfirming] = useState<DemoPlan | null>(null)

  if (!open) return null

  const handleSelect = (target: DemoPlan) => {
    if (target === currentPlan) {
      onClose()
      return
    }
    setConfirming(target)
  }

  const handleConfirm = (target: DemoPlan) => {
    setPlan(target)
    setConfirming(null)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-2xl animate-fade-up rounded-2xl border border-border/70 bg-card shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-content-center rounded-md bg-primary text-primary-foreground">
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-sm font-semibold text-foreground">Choose a plan</p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Demo mode — no payment required. Switch plans instantly.
            </p>
          </div>
          <button
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Plan cards */}
        {confirming ? (
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="grid size-12 place-content-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </span>
            <div className="space-y-1.5">
              <p className="text-lg font-semibold text-foreground">
                Switch to {PLAN_CONFIGS[confirming].label}?
              </p>
              <p className="text-sm text-muted-foreground">
                This is a demo. Your plan will switch immediately and persist in your browser.
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => setConfirming(null)}
                size="sm"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                className="gap-2"
                onClick={() => handleConfirm(confirming)}
                size="sm"
              >
                Confirm — switch to {PLAN_CONFIGS[confirming].label}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 p-6 sm:grid-cols-3">
            {PLAN_ORDER.map((planKey) => {
              const config = PLAN_CONFIGS[planKey]
              const isCurrent = planKey === currentPlan
              const isHighlighted = planKey === highlightPlan

              return (
                <div
                  key={planKey}
                  className={cn(
                    "relative flex flex-col rounded-xl border p-4 transition-colors",
                    isCurrent
                      ? "border-primary/40 bg-primary-soft/20"
                      : isHighlighted
                        ? "border-primary/25 bg-primary-soft/10"
                        : "border-border/60 bg-background/60"
                  )}
                >
                  {config.badge && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      {config.badge}
                    </span>
                  )}

                  <div className="mb-3">
                    <p className={cn("text-xs font-semibold uppercase tracking-wide", config.color)}>
                      {config.label}
                    </p>
                    <p className="mt-0.5 text-xl font-bold text-foreground">
                      {config.price}
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {planKey === "free" ? "/ mo" : "/ mo per user"}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
                  </div>

                  <ul className="mb-4 flex-1 space-y-1.5 text-xs text-foreground/80">
                    {planKey === "free" && (
                      <>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />3 maps</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />10 AI branch / mo</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />5 AI summaries / mo</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />5 snapshots / map</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />3 saved views</li>
                      </>
                    )}
                    {planKey === "pro" && (
                      <>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Unlimited maps</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Unlimited AI</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Unlimited snapshots</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Presentation mode</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Frames & actionable nodes</li>
                      </>
                    )}
                    {planKey === "team" && (
                      <>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Everything in Pro</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Direct member invites</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Role controls</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Team activity overview</li>
                        <li className="flex items-center gap-1.5"><Check className="size-3 shrink-0 text-primary" />Unlimited collaborators</li>
                      </>
                    )}
                  </ul>

                  <Button
                    className="w-full"
                    disabled={isCurrent}
                    onClick={() => handleSelect(planKey)}
                    size="sm"
                    variant={isCurrent ? "secondary" : isHighlighted ? "default" : "outline"}
                  >
                    {isCurrent ? "Current plan" : `Switch to ${config.label}`}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
