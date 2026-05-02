import {
  ArrowRight,
  Brain,
  Check,
  ChevronDown,
  GitBranchPlus,
  Minus,
  MonitorPlay,
  Sparkles,
  Users2,
  type LucideIcon,
} from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"

import {
  LandingDashboardPreview,
  LandingWorkspacePreview,
} from "@/components/landing/landing-product-previews"
import { PublicFooter } from "@/components/layout/public-footer"
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
import { useAuth } from "@/features/auth/auth-context"
import { useDemoPlan } from "@/features/demo-plan/demo-plan-context"
import { UpgradeModal } from "@/features/demo-plan/upgrade-modal"
import { type DemoPlan } from "@/lib/demo-plan"
import { cn } from "@/lib/utils"

// ── Feature highlights ────────────────────────────────────────────────────────

interface FeatureHighlight {
  description: string
  eyebrow: string
  icon: LucideIcon
  title: string
}

const featureHighlights: FeatureHighlight[] = [
  {
    eyebrow: "Visual thinking",
    title: "Organize ideas on a shared canvas",
    description:
      "Build branching maps that keep every connection visible. Structure complex topics into clear, navigable trees that your whole team can explore.",
    icon: GitBranchPlus,
  },
  {
    eyebrow: "Team collaboration",
    title: "Work together in real time",
    description:
      "See who is online, leave threaded comments, and mention teammates directly on any node. Your whole team stays in sync as the map evolves.",
    icon: Users2,
  },
  {
    eyebrow: "AI-powered",
    title: "Move faster with AI",
    description:
      "Generate branch suggestions from a single prompt and get AI-written summaries of any map. Let AI handle the structure so you can focus on thinking.",
    icon: Brain,
  },
  {
    eyebrow: "Present & decide",
    title: "Turn maps into decisions",
    description:
      "Snapshot any state, vote on branches, and walk through ideas in presentation mode. Maps become shareable presentations in one click.",
    icon: MonitorPlay,
  },
]

// ── Plans ─────────────────────────────────────────────────────────────────────

type PlanVariant = "default" | "outline"

interface Plan {
  badge: string | null
  cta: string
  ctaVariant: PlanVariant
  description: string
  features: string[]
  highlighted: boolean
  name: string
  period: string
  price: string
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "/ month",
    description: "Get started with visual mapping at no cost, forever.",
    cta: "Start for free",
    ctaVariant: "outline",
    badge: null,
    highlighted: false,
    features: [
      "3 maps",
      "2 collaborators per map",
      "Comments & replies",
      "Community templates",
      "10 AI branch generations / month",
      "5 AI summaries / month",
      "5 snapshots per map",
      "3 saved views",
    ],
  },
  {
    name: "Pro",
    price: "$9",
    period: "/ month per user",
    description: "More room to work and unlimited AI to move faster.",
    cta: "Get started",
    ctaVariant: "default",
    badge: "Most popular",
    highlighted: true,
    features: [
      "Unlimited maps",
      "Up to 15 collaborators per map",
      "Comments, @mentions & notifications",
      "All templates",
      "Unlimited AI branch generations",
      "Unlimited AI summaries",
      "Unlimited snapshots",
      "Unlimited saved views",
      "Presentation mode",
      "Frames & actionable nodes",
      "Priority support",
    ],
  },
  {
    name: "Team",
    price: "$19",
    period: "/ month per user",
    description: "Built for teams that need roles, invites, and coordination.",
    cta: "Get started",
    ctaVariant: "outline",
    badge: null,
    highlighted: false,
    features: [
      "Everything in Pro",
      "Unlimited collaborators per map",
      "Direct member invites",
      "Role controls (Admin / Editor / Viewer)",
      "@mentions & smart notifications",
      "Team activity overview",
      "SSO (coming soon)",
      "Dedicated support",
    ],
  },
]

// ── Comparison table ──────────────────────────────────────────────────────────

type CellValue = boolean | string

interface TableRow {
  free: CellValue
  label: string
  pro: CellValue
  team: CellValue
}

const tableRows: TableRow[] = [
  { label: "Maps",                      free: "3",          pro: "Unlimited",  team: "Unlimited"  },
  { label: "Collaborators per map",     free: "2",          pro: "15",         team: "Unlimited"  },
  { label: "Comments",                  free: true,         pro: true,         team: true         },
  { label: "Templates",                 free: "Community",  pro: "All",        team: "All"        },
  { label: "Saved views",              free: "3",          pro: "Unlimited",  team: "Unlimited"  },
  { label: "Snapshots",                free: "5 / map",    pro: "Unlimited",  team: "Unlimited"  },
  { label: "AI branch generations",    free: "10 / mo",    pro: "Unlimited",  team: "Unlimited"  },
  { label: "AI summaries",             free: "5 / mo",     pro: "Unlimited",  team: "Unlimited"  },
  { label: "Frames & actionable nodes", free: false,       pro: true,         team: true         },
  { label: "Presentation mode",        free: false,        pro: true,         team: true         },
  { label: "@mentions & notifications", free: false,       pro: true,         team: true         },
  { label: "Direct invites",           free: false,        pro: false,        team: true         },
  { label: "Role controls",            free: false,        pro: false,        team: true         },
  { label: "Team activity overview",   free: false,        pro: false,        team: true         },
  { label: "Support",                  free: "Community",  pro: "Priority",   team: "Dedicated"  },
]

// ── FAQ ───────────────────────────────────────────────────────────────────────

const faqItems = [
  {
    question: "Is there a free plan?",
    answer:
      "Yes. Branchly's Free plan is free forever — no credit card required. You can create up to 3 maps and work with 2 collaborators per map right away.",
  },
  {
    question: "Can I change plans later?",
    answer:
      "Yes. You can upgrade to Pro or Team at any time. Downgrades take effect at the end of your current billing period and your data is never lost.",
  },
  {
    question: "What happens when I reach a Free plan limit?",
    answer:
      "You'll see a prompt to upgrade. Your existing maps and all the work inside them stay fully accessible — you just won't be able to create new ones until you upgrade or remove an old map.",
  },
  {
    question: "How does AI usage work?",
    answer:
      "AI branch generation and AI summaries each count against your monthly allowance. On Free you get 10 branch generations and 5 summaries per month. On Pro and Team both are unlimited.",
  },
  {
    question: "How does per-user pricing work?",
    answer:
      "Pro and Team plans are billed per user per month. Each person who signs in to your workspace counts as one seat. You can add or remove users at any time.",
  },
  {
    question: "Does my team need separate accounts?",
    answer:
      "Yes — each collaborator has their own Branchly account. With Team you can invite members directly and assign roles (Admin, Editor, or Viewer) per map.",
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function TableCell({
  highlight = false,
  value,
}: {
  highlight?: boolean
  value: CellValue
}) {
  if (value === true) {
    return (
      <span
        className={cn(
          "inline-flex size-5 items-center justify-center rounded-full",
          highlight ? "bg-primary/15 text-primary" : "text-primary"
        )}
      >
        <Check className="size-3.5 stroke-[2.5]" />
      </span>
    )
  }
  if (value === false) {
    return <Minus className="size-4 text-muted-foreground/35" />
  }
  return (
    <span
      className={cn(
        "text-sm",
        highlight ? "font-medium text-foreground" : "text-muted-foreground"
      )}
    >
      {value}
    </span>
  )
}

function MobileTableCell({
  highlight = false,
  value,
}: {
  highlight?: boolean
  value: CellValue
}) {
  if (value === true) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs",
          highlight ? "font-medium text-primary" : "text-foreground"
        )}
      >
        <Check className="size-3.5" />
        Included
      </span>
    )
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Minus className="size-3.5" />
        Not included
      </span>
    )
  }

  return (
    <span
      className={cn(
        "text-xs",
        highlight ? "font-medium text-foreground" : "text-muted-foreground"
      )}
    >
      {value}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function PricingPage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [upgradeHighlight, setUpgradeHighlight] = useState<DemoPlan>("pro")
  const { isAuthenticated } = useAuth()
  const { plan: currentDemoPlan } = useDemoPlan()

  const handlePlanCta = (planName: string) => {
    if (!isAuthenticated) return
    const target = (planName.toLowerCase() as DemoPlan) || "pro"
    setUpgradeHighlight(target)
    setUpgradeModalOpen(true)
  }

  const scrollToPlans = () => {
    document
      .getElementById("plans")
      ?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-28 -z-10 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold"
            to="/"
          >
            <span className="grid size-7 place-content-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            Branchly
          </Link>

          <nav className="hidden items-center sm:flex">
            <Button asChild size="sm" variant="ghost">
              <Link
                className="font-semibold text-foreground"
                to="/pricing"
              >
                Pricing
              </Link>
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

      <main className="mx-auto w-full max-w-6xl px-4 pb-24 md:px-6">

        {/* ── Hero ── */}
        <section className="animate-fade-up py-16 text-center md:py-20">
          <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
            Simple, transparent pricing
          </span>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Start free. Scale when you&apos;re ready.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Every plan includes the core Branchly experience. Upgrade only
            when you need more collaborators, unlimited AI, or team controls.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="gap-2" size="lg">
              <Link to="/auth?tab=signup">
                Start for free
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button className="gap-2" onClick={scrollToPlans} size="lg" variant="outline">
              See the plans
            </Button>
          </div>
        </section>

        {/* ── Features in action ── */}
        <section className="pb-16">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything you need to think and build together
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Branchly combines visual mapping, live collaboration, and AI in
              one workspace.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featureHighlights.map((feature, index) => (
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
          </div>

          {/* Product preview */}
          <div
            className={cn(
              "mt-10 overflow-hidden rounded-[1.75rem] border shadow-sm",
              isDark
                ? "border-white/8 bg-card/80"
                : "border-border/70 bg-card/90"
            )}
          >
            <div className="border-b border-border/70 px-6 py-5 sm:px-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                    Product walkthrough
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">
                    From your map library to a live shared canvas.
                  </h3>
                </div>
                <Button asChild className="shrink-0 gap-2">
                  <Link to="/auth?tab=signup">
                    Try it free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <div
                className={cn(
                  "border-b p-5 sm:p-6 lg:border-b-0 lg:border-r",
                  isDark ? "border-white/8" : "border-border/70"
                )}
              >
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Dashboard — find and reopen any map
                </p>
                <div
                  className={cn(
                    "overflow-hidden rounded-[1.15rem] border shadow-sm",
                    isDark
                      ? "border-white/8 bg-[#100d1a]"
                      : "border-border/70 bg-card"
                  )}
                >
                  <LandingDashboardPreview />
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Map editor — canvas, navigator, inspector
                </p>
                <div
                  className={cn(
                    "overflow-hidden rounded-[1.15rem] border shadow-sm",
                    isDark
                      ? "border-white/8 bg-[#100d1a]"
                      : "border-border/70 bg-card"
                  )}
                >
                  <LandingWorkspacePreview />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pricing cards ── */}
        <section className="pb-16" id="plans">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Pick the plan that fits your work
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              No hidden fees. Cancel or change plans anytime.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                className={cn(
                  "relative flex flex-col rounded-[1.25rem] border p-6 transition-transform duration-300 hover:-translate-y-1",
                  plan.highlighted
                    ? isDark
                      ? "border-primary/45 bg-primary-soft/15 shadow-[0_0_0_1px_hsl(var(--primary)/0.25),0_20px_60px_hsl(var(--primary)/0.12)]"
                      : "border-primary/35 bg-primary-soft/40 shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_20px_50px_hsl(var(--primary)/0.10)]"
                    : "border-border/70 bg-card/95 shadow-sm"
                )}
                key={plan.name}
              >
                {plan.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-5 space-y-1.5">
                  <p
                    className={cn(
                      "text-sm font-semibold",
                      plan.highlighted
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1.5">
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      {plan.price}
                    </span>
                    <span className="mb-1 text-sm text-muted-foreground">
                      {plan.period}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                </div>

                {isAuthenticated ? (
                  <Button
                    className="w-full gap-2"
                    disabled={currentDemoPlan === plan.name.toLowerCase()}
                    onClick={() => handlePlanCta(plan.name)}
                    variant={
                      currentDemoPlan === plan.name.toLowerCase()
                        ? "secondary"
                        : plan.ctaVariant
                    }
                  >
                    {currentDemoPlan === plan.name.toLowerCase()
                      ? "Current plan"
                      : plan.cta}
                    {currentDemoPlan !== plan.name.toLowerCase() && (
                      <ArrowRight className="size-4" />
                    )}
                  </Button>
                ) : (
                  <Button
                    asChild
                    className="w-full gap-2"
                    variant={plan.ctaVariant}
                  >
                    <Link to="/auth?tab=signup">
                      {plan.cta}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                )}

                <div className="mt-5 space-y-2.5">
                  {plan.features.map((feature) => (
                    <div className="flex items-start gap-2.5" key={feature}>
                      <Check
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          plan.highlighted
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <span className="text-sm text-foreground/80">
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section className="pb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Compare plans
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              Every feature, side by side.
            </p>
          </div>

          <div className="space-y-3 md:hidden">
            {tableRows.map((row) => (
              <div
                className={cn(
                  "rounded-[1.25rem] border p-4 shadow-sm",
                  isDark ? "border-white/8 bg-card/80" : "border-border/70 bg-card/95"
                )}
                key={row.label}
              >
                <p className="text-sm font-semibold text-foreground">{row.label}</p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Free
                    </span>
                    <MobileTableCell value={row.free} />
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-xl border px-3 py-2.5",
                      isDark
                        ? "border-primary/25 bg-primary-soft/15"
                        : "border-primary/20 bg-primary-soft/30"
                    )}
                  >
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-primary">
                      Pro
                    </span>
                    <MobileTableCell highlight value={row.pro} />
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-3 py-2.5">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Team
                    </span>
                    <MobileTableCell value={row.team} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            className={cn(
              "hidden overflow-hidden rounded-[1.25rem] border shadow-sm md:block",
              isDark ? "border-white/8" : "border-border/70"
            )}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr
                    className={cn(
                      "border-b",
                      isDark ? "border-white/8" : "border-border/70"
                    )}
                  >
                    <th className="px-6 py-4 text-left text-sm font-medium text-muted-foreground">
                      Feature
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
                      Free
                    </th>
                    <th
                      className={cn(
                        "px-4 py-4 text-center text-sm font-semibold",
                        isDark ? "bg-primary-soft/15" : "bg-primary-soft/30"
                      )}
                    >
                      <span className="text-primary">Pro</span>
                    </th>
                    <th className="px-4 py-4 text-center text-sm font-semibold text-foreground">
                      Team
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row, index) => (
                    <tr
                      className={cn(
                        "border-b last:border-0",
                        isDark ? "border-white/6" : "border-border/60",
                        index % 2 !== 0
                          ? isDark
                            ? "bg-white/[0.02]"
                            : "bg-muted/25"
                          : ""
                      )}
                      key={row.label}
                    >
                      <td className="px-6 py-3.5 text-sm font-medium text-foreground/80">
                        {row.label}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          <TableCell value={row.free} />
                        </div>
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3.5 text-center",
                          isDark ? "bg-primary-soft/15" : "bg-primary-soft/30"
                        )}
                      >
                        <div className="flex justify-center">
                          <TableCell highlight value={row.pro} />
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex justify-center">
                          <TableCell value={row.team} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="pb-16">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
          </div>

          <div className="mx-auto max-w-2xl space-y-2">
            {faqItems.map((item, index) => (
              <div
                className={cn(
                  "overflow-hidden rounded-xl border transition-colors duration-150",
                  isDark ? "border-white/8 bg-card/60" : "border-border/70 bg-card/80",
                  openFaq === index &&
                    (isDark
                      ? "border-primary/30 bg-primary-soft/10"
                      : "border-primary/20 bg-primary-soft/20")
                )}
                key={item.question}
              >
                <button
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() =>
                    setOpenFaq(openFaq === index ? null : index)
                  }
                  type="button"
                >
                  <span className="text-sm font-medium text-foreground">
                    {item.question}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
                      openFaq === index && "rotate-180"
                    )}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="animate-fade-up">
          <div
            className={cn(
              "rounded-[1.75rem] border px-8 py-14 text-center",
              isDark
                ? "border-primary/25 bg-primary-soft/12"
                : "border-primary/20 bg-primary-soft/40"
            )}
          >
            <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
              Free to start
            </span>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to map your best ideas?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start for free in seconds. Upgrade when your team grows. No
              credit card required.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild className="gap-2" size="lg">
                <Link to="/auth?tab=signup">
                  Start for free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth?tab=login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <UpgradeModal
        highlightPlan={upgradeHighlight}
        onClose={() => setUpgradeModalOpen(false)}
        open={upgradeModalOpen}
      />

      <PublicFooter />
    </div>
  )
}
