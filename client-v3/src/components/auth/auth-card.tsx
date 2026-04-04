import { useEffect, useState, type FormEvent } from "react"
import { Github } from "lucide-react"

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
import { cn } from "@/lib/utils"

export type AuthTab = "login" | "signup"

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
  const [activeTab, setActiveTab] = useState<AuthTab>(defaultTab)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    setActiveTab(defaultTab)
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [defaultTab])

  useEffect(() => {
    setErrorMessage(null)
    setSuccessMessage(null)
  }, [activeTab])

  const activeContent = tabContent[activeTab]
  const isFormDisabled = !isConfigured || isSubmitting
  const submitLabel =
    isSubmitting && activeTab === "login"
      ? "Logging in..."
      : isSubmitting && activeTab === "signup"
        ? "Creating account..."
        : activeContent.submitLabel

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)
    setIsSubmitting(true)

    if (activeTab === "login") {
      const { error } = await signInWithPassword({ email, password })

      if (error) {
        setErrorMessage(error)
        setIsSubmitting(false)
        return
      }

      setIsSubmitting(false)
      onAuthSuccess?.()
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
  }

  return (
    <Card className={cn("border-border/80 bg-card/95 shadow-lg", className)}>
      <CardHeader className="space-y-4">
        <div className="inline-flex rounded-md border border-border/70 bg-muted/70 p-1">
          <button
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
            onClick={() => setActiveTab("login")}
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
            onClick={() => setActiveTab("signup")}
            type="button"
          >
            Sign up
          </button>
        </div>
        <div>
          <CardTitle>{activeContent.heading}</CardTitle>
          <CardDescription className="pt-1">
            {activeContent.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={handleSubmit}>
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
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="auth-password">
              Password
            </label>
            <Input
              autoComplete={
                activeTab === "login" ? "current-password" : "new-password"
              }
              disabled={isFormDisabled}
              id="auth-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              type="password"
              value={password}
            />
          </div>
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
        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/80" />
          </div>
          <p className="relative mx-auto w-fit bg-card px-2 text-xs text-muted-foreground">
            or continue with
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button className="w-full" disabled type="button" variant="outline">
            <svg
              aria-hidden="true"
              className="size-4"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.53-1.78 4.48-5.27 4.48-3.17 0-5.74-2.63-5.74-5.88s2.57-5.88 5.74-5.88c1.81 0 3.02.77 3.71 1.43l2.53-2.43C16.8 4.22 14.68 3.25 12.18 3.25 7.23 3.25 3.2 7.28 3.2 12.23s4.03 8.98 8.98 8.98c5.18 0 8.62-3.64 8.62-8.77 0-.59-.07-1.03-.15-1.34z"
                fill="currentColor"
              />
            </svg>
            Google
          </Button>
          <Button className="w-full" disabled type="button" variant="outline">
            <Github className="size-4" />
            GitHub
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          OAuth sign-in is not enabled in this workspace yet.
        </p>
      </CardContent>
    </Card>
  )
}
