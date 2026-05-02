import {
  ArrowRight,
  CheckCircle2,
  GitBranchPlus,
  LayoutDashboard,
  PlayCircle,
  Sparkles,
  Users2,
  type LucideIcon,
} from "lucide-react"
import { Link } from "react-router-dom"

import {
  LandingDashboardPreview,
  LandingWorkspacePreview,
} from "@/components/landing/landing-product-previews"
import { PublicFooter } from "@/components/layout/public-footer"
import { SupabaseWarning } from "@/components/supabase/supabase-warning"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { useTheme } from "@/components/theme/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

const heroHighlights = [
  "Live collaboration",
  "Readable canvas",
  "Map library to editor flow",
]

const featureCards: Array<{
  description: string
  eyebrow: string
  icon: LucideIcon
  title: string
}> = [
  {
    description:
      "Open a map and start shaping ideas immediately, without losing the structure of the graph.",
    eyebrow: "Canvas-first",
    icon: GitBranchPlus,
    title: "Map ideas visually",
  },
  {
    description:
      "See who is online, what is saving, and when the shared workspace is fully in sync.",
    eyebrow: "Shared editing",
    icon: Users2,
    title: "Keep collaboration readable",
  },
  {
    description:
      "Move from the map library to the editor in one flow, with navigator and inspector close by.",
    eyebrow: "Clear structure",
    icon: LayoutDashboard,
    title: "Stay oriented as maps grow",
  },
]

const workflowSteps = [
  {
    description:
      "Start in a focused map library where the next board is easy to find and reopen.",
    title: "Pick up the right map fast",
  },
  {
    description:
      "Jump straight into the workspace with the canvas, navigator, and inspector already in view.",
    title: "Open the editor without losing context",
  },
  {
    description:
      "Keep roles, save state, and presence visible while the map changes in real time.",
    title: "Collaborate with the status you need",
  },
]

export function LandingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  const scrollToDemo = () => {
    document
      .getElementById("demo-section")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-28 -z-10 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold" to="/">
            <span className="grid size-7 place-content-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            Branchly
          </Link>

          <nav className="hidden items-center sm:flex">
            <Button asChild size="sm" variant="ghost">
              <Link to="/pricing">Pricing</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle compact className="hidden shrink-0 sm:inline-flex" />
            <Button asChild variant="ghost">
              <Link to="/auth?tab=login">Log in</Link>
            </Button>
            <Button asChild>
              <Link to="/auth?tab=signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-10 md:px-6 md:pt-14">
        <section className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-center lg:gap-12">
          <div className="animate-fade-up space-y-6">
            <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
              Collaborative mind mapping
            </span>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Turn scattered ideas into a shared map your team can actually use.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                Capture ideas, connect them visually, and keep people, status,
                and structure in one readable workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                className="gap-2"
                size="lg"
              >
                <Link to="/auth?tab=signup">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button
                className="gap-2"
                onClick={scrollToDemo}
                size="lg"
                variant="outline"
              >
                <PlayCircle className="size-4" />
                See workflow
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {heroHighlights.map((highlight) => (
                <span
                  className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-1.5"
                  key={highlight}
                >
                  <CheckCircle2 className="size-4 text-primary" />
                  {highlight}
                </span>
              ))}
            </div>
            <SupabaseWarning className="max-w-xl" />
          </div>

          <div
            className="animate-fade-up"
            style={{ animationDelay: "90ms" }}
          >
            <div className="relative mx-auto max-w-4xl">
              <div
                className={cn(
                  "absolute inset-x-10 bottom-0 top-12 -z-20 rounded-[2.4rem] blur-3xl",
                  isDark ? "bg-primary/22" : "bg-primary/14"
                )}
              />
              <div
                className={cn(
                  "absolute inset-0 -z-10 rounded-[2rem] border",
                  isDark ? "border-white/6 bg-white/[0.03]" : "border-white/70 bg-white/70"
                )}
              />
              <div
                className={cn(
                  "overflow-hidden rounded-[1.85rem] border p-3 backdrop-blur-sm",
                  isDark
                    ? "border-primary/18 bg-card/80 shadow-[0_42px_120px_rgba(0,0,0,0.55)]"
                    : "border-border/70 bg-card/95 shadow-[0_36px_95px_rgba(15,23,42,0.18)]"
                )}
              >
                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] border px-4 py-3",
                    isDark ? "border-white/8 bg-white/[0.03]" : "border-border/70 bg-background/90"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-content-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <Sparkles className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Branchly workspace
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Structured visual collaboration
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                      Live collaboration
                    </span>
                    <span className="hidden rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
                      Canvas, navigator, inspector
                    </span>
                  </div>
                </div>
                <div
                  className={cn(
                    "mt-3 overflow-hidden rounded-[1.3rem] border",
                    isDark ? "border-white/8 bg-[#100d1a]" : "border-border/70 bg-background"
                  )}
                >
                  <LandingWorkspacePreview />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3">
                  <p className="text-sm font-medium text-foreground">
                    A calm editor built for shared visual thinking.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Clean demo content from the product workflow
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <Card
              className="animate-fade-up border-border/70 bg-card/95 shadow-sm transition-transform duration-300 hover:-translate-y-1"
              key={feature.title}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {feature.eyebrow}
                  </span>
                  <span className="inline-flex size-10 items-center justify-center rounded-2xl border border-primary/20 bg-primary-soft/70 text-primary">
                    <feature.icon className="size-4" />
                  </span>
                </div>
                <CardTitle className="text-base">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </section>

        <section
          className="mt-20 animate-fade-up rounded-[1.75rem] border border-border/70 bg-card/90 shadow-sm"
          id="demo-section"
        >
          <div className="border-b border-border/70 px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                  Product workflow
                </span>
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  From map library to live editing in one flow.
                </h2>
                <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Reopen the right map, enter the workspace, and keep
                  collaboration visible as the graph evolves.
                </p>
              </div>
              <Button asChild className="shrink-0 gap-2 sm:mt-1">
                <Link to="/auth?tab=signup">
                  Get started
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid min-w-0 gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div
              className={cn(
                "min-w-0 border-b p-5 lg:border-b-0 lg:border-r sm:p-6",
                isDark ? "border-white/8" : "border-border/70"
              )}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <span className="grid size-7 place-content-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                  <Sparkles className="size-3.5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                    Branchly dashboard
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Find and reopen the right map quickly
                  </p>
                </div>
              </div>
              <div
                className={cn(
                  "overflow-hidden rounded-[1.15rem] border shadow-sm",
                  isDark ? "border-white/8 bg-[#100d1a]" : "border-border/70 bg-card"
                )}
              >
                <LandingDashboardPreview />
              </div>
            </div>

            <div className="min-w-0 p-5 sm:p-6">
              <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                How it works
              </p>
              <div className="relative space-y-0">
                {workflowSteps.map((step, index) => (
                  <div className="relative flex gap-4" key={step.title}>
                    <div className="flex flex-col items-center">
                      <span className="relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary/30 bg-primary-soft text-xs font-bold text-primary">
                        {index + 1}
                      </span>
                      {index < workflowSteps.length - 1 ? (
                        <div className="mt-1 w-px flex-1 bg-border/60" />
                      ) : null}
                    </div>
                    <div className={cn("pb-6", index === workflowSteps.length - 1 && "pb-0")}>
                      <p className="pt-1 text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  )
}
