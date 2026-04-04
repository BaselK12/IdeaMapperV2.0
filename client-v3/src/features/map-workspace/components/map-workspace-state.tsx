import {
  AlertTriangle,
  ArrowLeft,
  LockKeyhole,
  SearchX,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type WorkspaceStateVariant = "error" | "no-access" | "not-found"

type WorkspaceStateConfig = {
  description: string
  icon: LucideIcon
  iconClassName: string
  title: string
}

const stateConfig: Record<WorkspaceStateVariant, WorkspaceStateConfig> = {
  error: {
    description:
      "The workspace could not be loaded right now. Retry, or return to your map list.",
    icon: AlertTriangle,
    iconClassName: "bg-destructive/10 text-destructive",
    title: "Could not load this workspace",
  },
  "no-access": {
    description:
      "This workspace is not available with your current account access.",
    icon: LockKeyhole,
    iconClassName:
      "bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))]",
    title: "Access required",
  },
  "not-found": {
    description:
      "The map link is invalid, or this workspace no longer exists in its original location.",
    icon: SearchX,
    iconClassName: "bg-primary-soft/80 text-primary",
    title: "Workspace not found",
  },
}

type MapWorkspaceStateProps = {
  detail?: string
  onRetry?: () => void
  variant: WorkspaceStateVariant
}

export function MapWorkspaceState({
  detail,
  onRetry,
  variant,
}: MapWorkspaceStateProps) {
  const config = stateConfig[variant]
  const Icon = config.icon

  return (
    <section className="animate-fade-up flex min-h-[60svh] items-center py-6 xl:h-[calc(100vh-2rem)] xl:min-h-[540px] xl:py-0">
      <Card className="mx-auto w-full max-w-2xl border-border/70 bg-card/95 shadow-lg">
        <CardHeader className="items-center space-y-4 pb-4 text-center">
          <div
            className={cn(
              "inline-flex size-12 items-center justify-center rounded-2xl",
              config.iconClassName
            )}
          >
            <Icon className="size-5" />
          </div>
          <CardTitle className="text-2xl tracking-tight">{config.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 px-8 pb-8 text-center">
          <p className="text-sm text-muted-foreground">{config.description}</p>
          {detail ? (
            <p className="rounded-xl border border-border/80 bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              {detail}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link to="/app">
                <ArrowLeft className="size-4" />
                Back to dashboard
              </Link>
            </Button>
            {onRetry ? <Button onClick={onRetry}>Retry loading</Button> : null}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}
