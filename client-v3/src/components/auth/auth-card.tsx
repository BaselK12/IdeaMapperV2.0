import { useState } from "react"
import { ArrowLeft, Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/auth-context"
import { normalizeAuthError, supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export type AuthTab = "login" | "signup"

// "forgot-password" is an internal view, not a selectable tab.
type InternalView = AuthTab | "forgot-password"

const MIN_PASSWORD_LENGTH = 8

type AuthCardProps = {
  className?: string
  defaultTab?: AuthTab
  onAuthSuccess?: () => void
}

const tabContent: Record<
  AuthTab,
  { description: string; heading: string; submitLabel: string }
> = {
  login: {
    description: "Welcome back. Enter your details to access your workspace.",
    heading: "Log in",
    submitLabel: "Log in",
  },
  signup: {
    description: "Create your account to start mapping ideas with your team.",
    heading: "Sign up",
    submitLabel: "Create account",
  },
}

export function AuthCard({
  className,
  defaultTab = "login",
  onAuthSuccess,
}: AuthCardProps) {
  const { isConfigured, signInWithPassword, signUpWithPassword } = useAuth()
  const [view, setView] = useState<InternalView>(defaultTab)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const changeView = (nextView: InternalView) => {
    setView(nextView)
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsPasswordVisible(false)
  }

  const isForgotPassword = view === "forgot-password"
  // The tab strip always reflects login/signup — forgot-password sits under login
  const activeTab: AuthTab = isForgotPassword ? "login" : view
  const activeContent = tabContent[activeTab]
  const isFormDisabled = !isConfigured || isSubmitting

  const submitLabel = isSubmitting
    ? view === "login"
      ? "Logging in…"
      : view === "signup"
        ? "Creating account…"
        : "Sending reset link…"
    : view === "forgot-password"
      ? "Send reset link"
      : activeContent.submitLabel

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    // ── Forgot password ────────────────────────────────────────────────────
    if (view === "forgot-password") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) {
        setErrorMessage(normalizeAuthError(error.message))
        setIsSubmitting(false)
        return
      }
      setSuccessMessage(
        "Reset link sent. Check your email — it may take a minute to arrive."
      )
      setIsSubmitting(false)
      return
    }

    // ── Sign up ────────────────────────────────────────────────────────────
    if (view === "signup") {
      // Client-side validation: enforce minimum length before hitting the API.
      if (password.length < MIN_PASSWORD_LENGTH) {
        setErrorMessage(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
        )
        setIsSubmitting(false)
        return
      }

      const { error, requiresEmailConfirmation } = await signUpWithPassword({
        email,
        password,
      })
      if (error) {
        setErrorMessage(error)
        setIsSubmitting(false)
        return
      }
      setIsSubmitting(false)
      if (requiresEmailConfirmation) {
        setSuccessMessage(
          "Account created. Check your email for a confirmation link, then log in."
        )
        return
      }
      onAuthSuccess?.()
      return
    }

    // ── Log in ─────────────────────────────────────────────────────────────
    const { error } = await signInWithPassword({ email, password })
    if (error) {
      setErrorMessage(error)
      setIsSubmitting(false)
      return
    }
    setIsSubmitting(false)
    onAuthSuccess?.()
  }

  return (
    <Card className={cn("border-border/80 bg-card/95 shadow-lg", className)}>
      <CardHeader className="space-y-4">
        {isForgotPassword ? (
          // Forgot-password: replace tab strip with a back link
          <button
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => changeView("login")}
            type="button"
          >
            <ArrowLeft className="size-3.5" />
            Back to sign in
          </button>
        ) : (
          <div className="inline-flex rounded-md border border-border/70 bg-muted/70 p-1">
            <button
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "login"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              onClick={() => changeView("login")}
              type="button"
            >
              Log in
            </button>
            <button
              className={cn(
                "rounded px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === "signup"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
              )}
              onClick={() => changeView("signup")}
              type="button"
            >
              Sign up
            </button>
          </div>
        )}

        <div>
          <CardTitle>
            {isForgotPassword ? "Reset your password" : activeContent.heading}
          </CardTitle>
          <CardDescription className="pt-1">
            {isForgotPassword
              ? "Enter your email and we'll send you a link to reset your password."
              : activeContent.description}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email — always visible */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="auth-email">
              Email
            </label>
            <Input
              autoComplete="email"
              disabled={isFormDisabled}
              id="auth-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>

          {/* Password — hidden on forgot-password view */}
          {!isForgotPassword && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium" htmlFor="auth-password">
                  Password
                </label>
                {view === "login" && (
                  <button
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    onClick={() => changeView("forgot-password")}
                    type="button"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  autoComplete={
                    view === "login" ? "current-password" : "new-password"
                  }
                  className="pr-10"
                  disabled={isFormDisabled}
                  id="auth-password"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    view === "signup"
                      ? `At least ${MIN_PASSWORD_LENGTH} characters`
                      : "Enter your password"
                  }
                  required
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={
                    isPasswordVisible ? "Hide password" : "Show password"
                  }
                  className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isFormDisabled}
                  onClick={() => setIsPasswordVisible((current) => !current)}
                  type="button"
                >
                  {isPasswordVisible ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          <Button className="w-full" disabled={isFormDisabled} type="submit">
            {submitLabel}
          </Button>

          {errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-xs text-[hsl(var(--success-foreground))]">
              {successMessage}
            </p>
          ) : null}

          {!isConfigured ? (
            <p className="text-xs text-muted-foreground">
              Authentication actions are disabled until Supabase env vars are
              set.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
