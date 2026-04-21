import { useEffect, useState } from "react"
import { ArrowLeft, Loader2, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PublicFooter } from "@/components/layout/public-footer"
import { hasSupabaseEnv, normalizeAuthError, supabase } from "@/lib/supabase"

const MIN_PASSWORD_LENGTH = 8

type Phase = "loading" | "form" | "success" | "invalid"

export function ResetPasswordPage() {
  const [phase, setPhase] = useState<Phase>(
    hasSupabaseEnv ? "loading" : "invalid"
  )
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  useEffect(() => {
    if (!hasSupabaseEnv) return

    // The Supabase SDK (detectSessionInUrl: true by default) automatically
    // detects the `code` query param that Supabase appends to the redirectTo
    // URL in the reset email, exchanges it for a recovery session, and fires
    // PASSWORD_RECOVERY via onAuthStateChange.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPhase("form")
      }
    })

    // If PASSWORD_RECOVERY doesn't fire within 8 s the link is
    // expired, already used, or opened in a different browser (which
    // would have lost the PKCE code_verifier from sessionStorage).
    const fallbackTimer = setTimeout(() => {
      setPhase((current) => (current === "loading" ? "invalid" : current))
    }, 8_000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(fallbackTimer)
    }
  }, [])

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault()
    setErrorMessage(null)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      )
      return
    }

    setIsSubmitting(true)

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrorMessage(normalizeAuthError(error.message))
      setIsSubmitting(false)
      return
    }

    // Sign out the short-lived recovery session so the auth context
    // doesn't treat the user as fully authenticated after the reset.
    await supabase.auth.signOut()
    setPhase("success")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-primary-soft/80 via-background to-background" />
      <div className="pointer-events-none absolute -right-20 top-16 -z-10 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 md:px-6">
        <div className="animate-fade-up flex items-center justify-between">
          <Button asChild variant="ghost">
            <Link to="/auth">
              <ArrowLeft className="size-4" />
              Back to sign in
            </Link>
          </Button>
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-4 text-primary" />
            Branchly
          </p>
        </div>

        <div className="mt-10 flex flex-1 items-center justify-center pb-12">
          <div className="w-full max-w-md">

            {phase === "loading" && (
              <Card className="border-border/80 bg-card/95 shadow-lg">
                <CardContent className="flex flex-col items-center gap-3 py-14">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Verifying reset link…
                  </p>
                </CardContent>
              </Card>
            )}

            {phase === "invalid" && (
              <Card className="border-border/80 bg-card/95 shadow-lg">
                <CardHeader className="space-y-1 text-center">
                  <CardTitle>Reset link invalid or expired</CardTitle>
                  <CardDescription>
                    This password reset link has expired or has already been
                    used. Request a new one from the sign-in page.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <Button asChild variant="outline">
                    <Link to="/auth">Back to sign in</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {phase === "form" && (
              <Card className="border-border/80 bg-card/95 shadow-lg">
                <CardHeader className="space-y-1">
                  <CardTitle>Set a new password</CardTitle>
                  <CardDescription>
                    Enter a new password for your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form className="space-y-4" onSubmit={handleSubmit}>
                    <div className="space-y-1.5">
                      <label
                        className="text-sm font-medium"
                        htmlFor="new-password"
                      >
                        New password
                      </label>
                      <Input
                        autoComplete="new-password"
                        autoFocus
                        disabled={isSubmitting}
                        id="new-password"
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                        required
                        type="password"
                        value={password}
                      />
                    </div>
                    <Button
                      className="w-full"
                      disabled={isSubmitting}
                      type="submit"
                    >
                      {isSubmitting ? "Updating password…" : "Update password"}
                    </Button>
                    {errorMessage ? (
                      <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                        {errorMessage}
                      </p>
                    ) : null}
                  </form>
                </CardContent>
              </Card>
            )}

            {phase === "success" && (
              <Card className="border-border/80 bg-card/95 shadow-lg">
                <CardHeader className="space-y-1 text-center">
                  <CardTitle>Password updated</CardTitle>
                  <CardDescription>
                    Your password has been changed. Sign in with your new
                    password to continue.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <Button asChild>
                    <Link to="/auth">Sign in</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

          </div>
        </div>

        <PublicFooter />
      </div>
    </div>
  )
}
