import { useState } from "react"
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
import { Link, useNavigate } from "react-router-dom"

import dashboardDarkScreenshot from "@/assets/landing/landing-dashboard-dark.png"
import dashboardLightScreenshot from "@/assets/landing/landing-dashboard-light.png"
import workspaceDarkScreenshot from "@/assets/landing/landing-workspace-dark.png"
import workspaceLightScreenshot from "@/assets/landing/landing-workspace-light.png"
import { AuthModal } from "@/components/auth/auth-modal"
import { type AuthTab } from "@/components/auth/auth-card"
import { SupabaseWarning } from "@/components/supabase/supabase-warning"
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
  const navigate = useNavigate()
  const { resolvedTheme } = useTheme()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authDefaultTab, setAuthDefaultTab] = useState<AuthTab>("signup")
  const isDark = resolvedTheme === "dark"
  const heroScreenshot =
    resolvedTheme === "dark" ? workspaceDarkScreenshot : workspaceLightScreenshot
  const workflowScreenshot =
    resolvedTheme === "dark" ? dashboardDarkScreenshot : dashboardLightScreenshot

  const openAuthModal = (tab: AuthTab) => {
    setAuthDefaultTab(tab)
    setIsAuthModalOpen(true)
  }

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
          <div className="flex items-center gap-2">
            <Button onClick={() => openAuthModal("login")} variant="ghost">
              Log in
            </Button>
            <Button onClick={() => openAuthModal("signup")}>Get started</Button>
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
                className="gap-2"
                onClick={() => openAuthModal("signup")}
                size="lg"
              >
                Get started
                <ArrowRight className="size-4" />
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
                  <img
                    alt="Branchly workspace showing canvas, navigator, participants, and inspector."
                    className="block h-auto w-full"
                    src={heroScreenshot}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3">
                  <p className="text-sm font-medium text-foreground">
                    A calm editor built for shared visual thinking.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Real product capture from the live workspace
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
          className="mt-20 animate-fade-up rounded-[1.75rem] border border-border/70 bg-card/90 p-6 shadow-sm sm:p-8"
          id="demo-section"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                Product workflow
              </span>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Move from map library to live editing without a handoff.
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                The product flow stays compact: reopen the right map, enter the
                workspace, and keep collaboration visible while the graph changes.
              </p>
            </div>
            <div
              className={cn(
                "w-full rounded-2xl border p-4 shadow-sm lg:w-auto lg:min-w-[18rem]",
                isDark
                  ? "border-primary/20 bg-primary/10"
                  : "border-primary/15 bg-primary-soft/65"
              )}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                Start with Branchly
              </p>
              <p className="mt-1 text-sm text-foreground">
                Create your first shared map and move straight into the workspace.
              </p>
              <Button
                className="mt-3 w-full gap-2 lg:w-auto"
                onClick={() => openAuthModal("signup")}
              >
                Create your first shared map
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] lg:items-start">
            <div
              className={cn(
                "rounded-[1.5rem] border p-3 shadow-sm",
                isDark ? "border-primary/12 bg-background/55" : "border-border/70 bg-background/80"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between rounded-[1rem] border px-3 py-2",
                  isDark ? "border-white/8 bg-white/[0.03]" : "border-border/70 bg-card/85"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-content-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                      Branchly dashboard
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Find the right map and reopen it quickly
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
                  Real product view
                </span>
              </div>
              <div
                className={cn(
                  "mt-3 overflow-hidden rounded-[1.15rem] border",
                  isDark ? "border-white/8 bg-[#100d1a]" : "border-border/70 bg-card"
                )}
              >
                <img
                  alt="Branchly dashboard showing the map library and primary actions."
                  className="block h-auto w-full"
                  src={workflowScreenshot}
                />
              </div>
            </div>

            <div className="space-y-3">
              {workflowSteps.map((step, index) => (
                <div
                  className="rounded-2xl border border-border/70 bg-background/75 p-4 shadow-sm"
                  key={step.title}
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary-soft/70 text-sm font-semibold text-primary">
                      0{index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <AuthModal
        defaultTab={authDefaultTab}
        onAuthSuccess={() => navigate("/app")}
        onOpenChange={setIsAuthModalOpen}
        open={isAuthModalOpen}
      />
    </div>
  )
}
