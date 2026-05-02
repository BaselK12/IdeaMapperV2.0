import { useEffect, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/features/auth/auth-context"
import {
  acceptMapInvite,
  getMapInviteByToken,
} from "@/features/map-workspace/api/map-invites-api"
import type {
  AcceptInviteResult,
  MapInvitePreview,
} from "@/features/map-workspace/types/map-invites-types"
import { createNotificationForUser } from "@/features/notifications/api/notifications-api"

function formatRole(role: string) {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function getDisplayName(user: ReturnType<typeof useAuth>["user"]) {
  if (!user) return "Someone"
  const meta = user.user_metadata
  const name =
    (typeof meta?.full_name === "string" ? meta.full_name.trim() : "") ||
    (typeof meta?.name === "string" ? meta.name.trim() : "") ||
    (typeof meta?.username === "string" ? meta.username.trim() : "") ||
    user.email?.split("@")[0] ||
    "Someone"
  return name
}

export function MapInvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [preview, setPreview] = useState<MapInvitePreview | null>(null)
  const [previewState, setPreviewState] = useState<
    "loading" | "ready" | "not-found" | "wrong-email"
  >("loading")
  const [acceptResult, setAcceptResult] = useState<AcceptInviteResult | null>(null)
  const [isAccepting, setIsAccepting] = useState(false)
  const didFetchRef = useRef(false)

  useEffect(() => {
    if (!token || didFetchRef.current) return
    didFetchRef.current = true

    const fetch = async () => {
      try {
        const result = await getMapInviteByToken(token)
        if (!result) {
          setPreviewState("not-found")
        } else {
          setPreview(result)
          setPreviewState("ready")
        }
      } catch {
        setPreviewState("not-found")
      }
    }

    void fetch()
  }, [token])

  const handleAccept = async () => {
    if (!token || isAccepting) return
    setIsAccepting(true)

    const result = await acceptMapInvite(token)
    setAcceptResult(result)

    if (result.success && preview) {
      // Best-effort: notify the inviter that the invite was accepted
      void createNotificationForUser({
        data: {
          inviteeEmail: user?.email ?? "",
          inviteeName: getDisplayName(user),
          mapName: preview.mapName,
          role: result.role,
        },
        mapId: result.mapId,
        type: "map_invite_accepted",
        userId: preview.invitedById,
      })

      setTimeout(() => {
        navigate(`/app/map/${result.mapId}`, { replace: true })
      }, 2200)
    }

    setIsAccepting(false)
  }

  if (previewState === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">Loading invite…</p>
        </div>
      </div>
    )
  }

  if (previewState === "not-found") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Invite not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite link may have expired, already been used, or is not for
          your account. Ask the map owner to send a new invite.
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/app">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  if (acceptResult && !acceptResult.success) {
    const errorMessages: Record<typeof acceptResult.error, string> = {
      email_mismatch:
        "This invite was sent to a different email address. Sign in with the invited email and try again.",
      not_authenticated: "You need to be signed in to accept this invite.",
      not_found: "This invite has expired or already been used.",
      unknown: "Something went wrong. Please try again.",
    }
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <AlertTriangle className="mx-auto size-10 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Invite could not be accepted
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {errorMessages[acceptResult.error]}
        </p>
        <Button asChild className="mt-6" variant="outline">
          <Link to="/app">Go to dashboard</Link>
        </Button>
      </div>
    )
  }

  if (acceptResult?.success) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <CheckCircle2 className="mx-auto size-10 text-[hsl(var(--success-foreground))]" />
        <h1 className="mt-4 text-lg font-semibold text-foreground">
          Welcome to {acceptResult.mapName}!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You joined as{" "}
          <span className="font-medium text-foreground">
            {formatRole(acceptResult.role)}
          </span>
          . Taking you there now…
        </p>
      </div>
    )
  }

  // previewState === "ready"
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="rounded-2xl border border-border/70 bg-card/95 p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
          Map invite
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          {preview?.mapName ?? "Untitled map"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {preview?.invitedByName ?? "A teammate"}
          </span>{" "}
          invited you to join as{" "}
          <span className="font-medium text-foreground">
            {formatRole(preview?.role ?? "viewer")}
          </span>
          .
        </p>

        {user ? (
          <p className="mt-3 rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
            Signing in as{" "}
            <span className="font-medium text-foreground">{user.email}</span>
          </p>
        ) : null}

        <div className="mt-6 flex items-center gap-3">
          <Button
            className="flex-1"
            disabled={isAccepting}
            onClick={() => void handleAccept()}
            type="button"
          >
            {isAccepting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Joining…
              </>
            ) : (
              "Accept invite"
            )}
          </Button>
          <Button asChild variant="ghost">
            <Link to="/app">Decline</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
