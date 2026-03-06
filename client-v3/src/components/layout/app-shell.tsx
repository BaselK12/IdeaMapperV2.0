import { useState } from "react"
import { LogOut, ShieldCheck } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"

import { SupabaseWarning } from "@/components/supabase/supabase-warning"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/features/auth/auth-context"

export function AppShell() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  const handleSignOut = async () => {
    setSignOutError(null)
    setIsSigningOut(true)

    const { error } = await signOut()

    if (error) {
      setSignOutError(error)
      setIsSigningOut(false)
      return
    }

    navigate("/", { replace: true })
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-8 md:px-6">
        <header className="animate-fade-up flex items-center justify-between">
          <p className="inline-flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="size-4 text-primary" />
            Protected App Placeholder
          </p>
          <Button disabled={isSigningOut} onClick={handleSignOut} variant="outline">
            <LogOut className="size-4" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </header>

        <main className="mt-12 flex flex-1 items-start justify-center">
          <Card className="animate-fade-up w-full max-w-2xl border-border/70 bg-card/90 shadow-md">
            <CardHeader>
              <CardTitle>V3 App Shell</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <p>
                This route is intentionally minimal and protected. Replace this
                with your authenticated product shell as V3 features are added.
              </p>
              <SupabaseWarning />
              {signOutError ? (
                <p className="text-xs text-destructive">{signOutError}</p>
              ) : null}
              <div>
                <Button asChild>
                  <Link to="/">Back to landing</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  )
}
