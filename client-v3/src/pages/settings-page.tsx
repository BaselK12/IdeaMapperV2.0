import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Mail,
  Palette,
  UserRound,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/features/auth/auth-context"
import { normalizeAuthError, supabase } from "@/lib/supabase"

type FeedbackState = {
  message: string
  tone: "error" | "success"
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) {
    return ""
  }

  const metadata = user.user_metadata
  const metadataName =
    normalizeOptionalText(metadata?.full_name) ||
    normalizeOptionalText(metadata?.name) ||
    normalizeOptionalText(metadata?.username)

  if (metadataName) {
    return metadataName
  }

  return normalizeOptionalText(user.email?.split("@")[0])
}

export function SettingsPage() {
  const { user } = useAuth()
  const email = user?.email ?? ""
  const [displayName, setDisplayName] = useState(() => getDisplayName(user))
  const [profileFeedback, setProfileFeedback] = useState<FeedbackState | null>(null)
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState | null>(
    null
  )
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)

  const accountInitial = useMemo(() => {
    const source = displayName || email || "B"
    return source.charAt(0).toUpperCase()
  }, [displayName, email])

  useEffect(() => {
    setDisplayName(getDisplayName(user))
  }, [user])

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextDisplayName = displayName.trim()

    if (!nextDisplayName) {
      setProfileFeedback({
        message: "Display name is required.",
        tone: "error",
      })
      return
    }

    setIsSavingProfile(true)
    setProfileFeedback(null)

    const { error } = await supabase.auth.updateUser({
      data: {
        full_name: nextDisplayName,
        name: nextDisplayName,
        username: nextDisplayName,
      },
    })

    setIsSavingProfile(false)

    if (error) {
      setProfileFeedback({
        message: normalizeAuthError(error.message),
        tone: "error",
      })
      return
    }

    setProfileFeedback({
      message: "Profile updated.",
      tone: "success",
    })
  }

  const handleSendResetLink = async () => {
    if (!email) {
      setPasswordFeedback({
        message: "No email address is available for this account.",
        tone: "error",
      })
      return
    }

    setIsSendingReset(true)
    setPasswordFeedback(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setIsSendingReset(false)

    if (error) {
      setPasswordFeedback({
        message: normalizeAuthError(error.message),
        tone: "error",
      })
      return
    }

    setPasswordFeedback({
      message: "Password reset link sent.",
      tone: "success",
    })
  }

  return (
    <section className="space-y-5">
      <div className="animate-fade-up rounded-2xl border border-border/70 bg-card/95 p-5 shadow-sm md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              Account
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              Settings
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
              Manage how your account appears in Branchly workspaces.
            </p>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/80 px-3 py-2.5">
            <span className="grid size-10 place-content-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {accountInitial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {displayName || "Branchly user"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {email || "Signed in"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4 text-primary" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleProfileSubmit}>
              <div className="space-y-2.5">
                <label className="text-sm font-medium text-foreground" htmlFor="display-name">
                  Display name
                </label>
                <Input
                  id="display-name"
                  maxLength={80}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                  value={displayName}
                />
                <p className="text-xs text-muted-foreground">
                  This name appears in collaboration presence and shared workspace UI.
                </p>
              </div>

              <div className="space-y-2.5">
                <label className="text-sm font-medium text-foreground" htmlFor="account-email">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    id="account-email"
                    readOnly
                    value={email}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Email changes are handled by your sign-in provider.
                </p>
              </div>

              {profileFeedback ? (
                <p
                  className={
                    profileFeedback.tone === "success"
                      ? "inline-flex items-center gap-2 rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success-foreground))]"
                      : "inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  }
                >
                  {profileFeedback.tone === "success" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                  {profileFeedback.message}
                </p>
              ) : null}

              <div className="flex justify-end">
                <Button disabled={isSavingProfile} type="submit">
                  {isSavingProfile ? "Saving..." : "Save profile"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Palette className="size-4 text-primary" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Choose the theme Branchly uses on this device.
              </p>
              <ThemeToggle />
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <KeyRound className="size-4 text-primary" />
                Password
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Send a secure reset link to your account email.
              </p>
              <Button
                disabled={isSendingReset || !email}
                onClick={handleSendResetLink}
                type="button"
                variant="outline"
              >
                {isSendingReset ? "Sending..." : "Send reset link"}
              </Button>

              {passwordFeedback ? (
                <p
                  className={
                    passwordFeedback.tone === "success"
                      ? "inline-flex items-center gap-2 rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success-foreground))]"
                      : "inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                  }
                >
                  {passwordFeedback.tone === "success" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <AlertCircle className="size-4" />
                  )}
                  {passwordFeedback.message}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}
