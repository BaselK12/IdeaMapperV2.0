import { ArrowLeft, Sparkles } from "lucide-react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"

import { AuthCard } from "@/components/auth/auth-card"
import { SupabaseWarning } from "@/components/supabase/supabase-warning"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"

type AuthLocationState = {
  from?: string
}

export function AuthPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isLoading } = useAuth()
  const from =
    (location.state as AuthLocationState | null)?.from?.trim() || "/app"

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Checking session...</p>
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate replace to="/app" />
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -right-20 top-16 -z-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-40 -z-10 hidden h-72 w-72 rounded-full bg-primary/5 blur-3xl lg:block" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 md:px-6">
        <div className="animate-fade-up flex items-center justify-between">
          <Button asChild variant="ghost">
            <Link to="/">
              <ArrowLeft className="size-4" />
              Back
            </Link>
          </Button>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            ideaMapper V3
          </p>
        </div>

        <div className="mt-10 grid flex-1 items-center gap-10 pb-12 lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-14">
          <section className="hidden animate-fade-up lg:block">
            <div className="max-w-xl space-y-6">
              <span className="inline-flex items-center rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-foreground">
                Secure access
              </span>
              <div className="space-y-3">
                <h1 className="text-4xl font-semibold tracking-tight text-foreground">
                  Sign in and get back to your maps without losing context.
                </h1>
                <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                  Use the same workspace flow to open your dashboard, return to a
                  requested map, and continue collaborating with less visual
                  friction.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">
                    Direct sign-in
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Keep access simple with one clear entry point into the app.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">
                    Return to flow
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Go back to the dashboard or requested route after auth.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-card/95 p-4 shadow-sm">
                  <p className="text-sm font-semibold text-foreground">
                    Shared workspace
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Pick up map work quickly once the session is ready.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="mx-auto flex w-full max-w-md flex-col gap-4 lg:mx-0 lg:max-w-none">
            <SupabaseWarning className="animate-fade-up" />
            <AuthCard
              className="animate-fade-up"
              defaultTab="login"
              onAuthSuccess={() => navigate(from, { replace: true })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
