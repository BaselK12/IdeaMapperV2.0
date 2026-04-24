import { Button } from "@/components/ui/button"
import type {
  MapWorkspaceParticipant,
  MapWorkspaceParticipantPresence,
} from "@/features/map-workspace/types/map-workspace-presence-types"
import { cn } from "@/lib/utils"

type MapWorkspaceParticipantStripProps = {
  errorMessage: string | null
  isLoading: boolean
  isPresenceUnavailable: boolean
  onRetry: () => void
  participants: MapWorkspaceParticipant[]
}

const MAX_AVATARS = 7

const warningStatusClassName =
  "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))]"

function presenceDotClassName(presence: MapWorkspaceParticipantPresence) {
  if (presence === "online") return "bg-[hsl(var(--success-foreground))]"
  if (presence === "offline") return "bg-muted-foreground/60"
  return "bg-[hsl(var(--warning-foreground))]"
}

function initialsFromName(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

function participantTitle(p: MapWorkspaceParticipant) {
  const role = p.role.charAt(0).toUpperCase() + p.role.slice(1)
  const status = p.presence === "online" ? "online" : "offline"
  return `${p.displayName} — ${role} · ${status}`
}

export function MapWorkspaceParticipantStrip({
  errorMessage,
  isLoading,
  isPresenceUnavailable,
  onRetry,
  participants,
}: MapWorkspaceParticipantStripProps) {
  const onlineCount = participants.filter((p) => p.presence === "online").length
  const offlineCount = participants.filter((p) => p.presence === "offline").length
  const visibleAvatars = participants.slice(0, MAX_AVATARS)
  const overflowCount = Math.max(0, participants.length - MAX_AVATARS)

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border/70 bg-card/80 px-2.5 py-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        Participants
      </span>

      {isLoading && participants.length === 0 ? (
        <div className="flex items-center gap-1">
          <div className="h-5 w-5 animate-pulse rounded-full bg-muted" />
          <div className="h-5 w-5 animate-pulse rounded-full bg-muted/70" />
          <div className="h-3 w-16 animate-pulse rounded bg-muted/60" />
        </div>
      ) : (
        <>
          {visibleAvatars.length > 0 ? (
            <div className="flex max-w-full flex-wrap items-center gap-1.5">
              {visibleAvatars.map((p) => (
                <span
                  className={cn(
                    "relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase",
                    p.isCurrentUser
                      ? "border-primary/60 bg-primary-soft text-primary"
                      : "border-border/80 bg-muted/80 text-foreground"
                  )}
                  key={p.id}
                  title={participantTitle(p)}
                >
                  {initialsFromName(p.displayName)}
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 size-2 rounded-full border border-card",
                      presenceDotClassName(p.presence)
                    )}
                  />
                </span>
              ))}
              {overflowCount > 0 ? (
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card/90 text-[10px] font-semibold text-muted-foreground">
                  +{overflowCount}
                </span>
              ) : null}
            </div>
          ) : null}

          <span className="whitespace-nowrap text-[10px] text-muted-foreground">
            {onlineCount} online · {offlineCount} offline
          </span>

          {isPresenceUnavailable ? (
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 text-[10px]",
                warningStatusClassName
              )}
            >
              Presence delayed
            </span>
          ) : null}

          {errorMessage ? (
            <Button
              className="h-5 px-2 text-[10px]"
              onClick={onRetry}
              size="sm"
              variant="outline"
            >
              Retry
            </Button>
          ) : null}
        </>
      )}
    </div>
  )
}
