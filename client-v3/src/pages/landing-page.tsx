import { useState } from "react"
import { ArrowRight, PlayCircle, Sparkles } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { AuthModal } from "@/components/auth/auth-modal"
import { type AuthTab } from "@/components/auth/auth-card"
import { SupabaseWarning } from "@/components/supabase/supabase-warning"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const featureCards = [
  {
    description: "Start from prompts and convert ideas into structured maps in seconds.",
    title: "AI-assisted mapping",
  },
  {
    description: "Share live boards and keep your team aligned as ideas evolve.",
    title: "Real-time collaboration",
  },
  {
    description: "Move from brainstorm to roadmap with reusable structures.",
    title: "Execution-ready output",
  },
]

export function LandingPage() {
  const navigate = useNavigate()
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authDefaultTab, setAuthDefaultTab] = useState<AuthTab>("signup")

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

      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold" to="/">
            <span className="grid size-7 place-content-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            ideaMapper V3
          </Link>
          <div className="flex items-center gap-2">
            <Button onClick={() => openAuthModal("login")} variant="ghost">
              Log in
            </Button>
            <Button onClick={() => openAuthModal("signup")}>Get started</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-14 md:px-6">
        <section className="animate-fade-up space-y-6">
          <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
            V3 foundation
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Build and share idea maps with a clean, scalable workspace.
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            This landing page is the starting point for V3. Hook in your data,
            auth logic, and product flows without touching V2 behavior.
          </p>
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
              Watch demo
            </Button>
          </div>
          <SupabaseWarning className="max-w-2xl" />
        </section>

        <section className="mt-14 grid gap-4 md:grid-cols-3">
          {featureCards.map((feature, index) => (
            <Card
              className="animate-fade-up border-border/70 bg-card/80 transition-transform duration-300 hover:-translate-y-1"
              key={feature.title}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <CardHeader className="pb-3">
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
          className="mt-16 animate-fade-up rounded-2xl border border-border/70 bg-card/70 p-6 sm:p-8"
          id="demo-section"
        >
          <h2 className="text-2xl font-semibold tracking-tight">Demo Section</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Add your product walkthrough, screenshots, or short clip here. The
            “Watch demo” button above scrolls directly to this section.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
              Product preview placeholder
            </div>
            <div className="rounded-xl border border-dashed border-border/80 bg-muted/40 p-5 text-sm text-muted-foreground">
              Conversion CTA placeholder
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
