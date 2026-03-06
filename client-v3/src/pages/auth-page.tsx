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

        <div className="mx-auto mt-10 flex w-full max-w-md flex-1 flex-col justify-center gap-4 pb-12">
          <SupabaseWarning className="animate-fade-up" />
          <AuthCard
            className="animate-fade-up"
            defaultTab="login"
            onAuthSuccess={() => navigate(from, { replace: true })}
          />
        </div>
      </div>
    </div>
  )
}
