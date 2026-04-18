import { ArrowLeft, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { PublicFooter } from "@/components/layout/public-footer"

export function NotFoundPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -right-20 top-16 -z-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 md:px-6">
        <div className="flex items-center justify-between">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Home
            </Link>
          </Button>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Branchly
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-12 text-center">
          <div className="inline-flex size-20 items-center justify-center rounded-3xl border border-border/70 bg-card/90 shadow-sm">
            <span className="text-3xl font-bold text-muted-foreground/60">
              404
            </span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Page not found
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              The page you're looking for doesn't exist or has been moved. Head
              back to safety.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link to="/">Go to home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>

        <PublicFooter />
      </div>
    </div>
  )
}
