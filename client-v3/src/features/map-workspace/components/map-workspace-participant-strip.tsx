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

const MAX_VISIBLE_PARTICIPANTS = 6

function roleBadgeClassName(role: string) {
  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === "admin" || normalizedRole === "owner") {
    return "border-violet-300/70 bg-violet-100 text-violet-700"
  }

  if (normalizedRole === "editor" || normalizedRole === "member") {
    return "border-blue-300/70 bg-blue-100 text-blue-700"
  }

  return "border-slate-300/70 bg-slate-100 text-slate-700"
}

function formatRole(role: string) {
  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === "admin" || normalizedRole === "owner") {
    return "Admin"
  }

  if (normalizedRole === "editor" || normalizedRole === "member") {
    return "Editor"
  }

  if (normalizedRole === "viewer") {
    return "Viewer"
  }

  return "Member"
}

function presenceCopy(presence: MapWorkspaceParticipantPresence) {
  if (presence === "online") {
    return "Online"
  }

  if (presence === "offline") {
    return "Offline"
  }

  return "Unknown"
}

function presenceDotClassName(presence: MapWorkspaceParticipantPresence) {
  if (presence === "online") {
    return "bg-emerald-500"
  }

  if (presence === "offline") {
    return "bg-slate-400"
  }

  return "bg-amber-500"
}

function initialsFromName(name: string) {
  const normalizedName = name.trim()
  if (!normalizedName) {
    return "?"
  }

  const words = normalizedName.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

export function MapWorkspaceParticipantStrip({
  errorMessage,
  isLoading,
  isPresenceUnavailable,
  onRetry,
  participants,
}: MapWorkspaceParticipantStripProps) {
  const visibleParticipants = participants.slice(0, MAX_VISIBLE_PARTICIPANTS)
  const hiddenParticipantsCount = Math.max(
    0,
    participants.length - visibleParticipants.length
  )
  const onlineCount = participants.filter(
    (participant) => participant.presence === "online"
  ).length
  const currentUserParticipant = participants.find(
    (participant) => participant.isCurrentUser
  )
  const onlineOthersCount = participants.filter(
    (participant) => participant.presence === "online" && !participant.isCurrentUser
  ).length
  const showOnlyYouMessage =
    !isLoading &&
    !isPresenceUnavailable &&
    currentUserParticipant?.presence === "online" &&
    onlineOthersCount === 0

  return (
    <section className="rounded-xl border border-border/80 bg-background/85 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Participants
          </p>
          {isLoading ? (
            <span className="h-5 w-24 animate-pulse rounded-full bg-muted" />
          ) : (
            <span className="rounded-full border border-border/70 bg-card/90 px-2 py-0.5 text-[11px] text-muted-foreground">
              {onlineCount} online • {participants.length} total
            </span>
          )}
        </div>

        {isPresenceUnavailable ? (
          <span className="rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
            Presence delayed
          </span>
        ) : null}
      </div>

      {isLoading && participants.length === 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <div className="h-8 w-44 animate-pulse rounded-full bg-muted/85" />
          <div className="h-8 w-36 animate-pulse rounded-full bg-muted/70" />
          <div className="h-8 w-28 animate-pulse rounded-full bg-muted/60" />
        </div>
      ) : (
        <>
          {errorMessage ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-2.5 py-1.5">
              <p className="text-xs text-amber-700">
                Participant list may be out of date.
              </p>
              <Button
                className="h-6 px-2 text-[11px]"
                onClick={onRetry}
                size="sm"
                variant="outline"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {showOnlyYouMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Only you are online right now.
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {visibleParticipants.map((participant) => (
              <div
                className={cn(
                  "inline-flex max-w-full items-center gap-2 rounded-full border px-2 py-1.5 text-xs",
                  participant.isCurrentUser
                    ? "border-primary/30 bg-primary-soft/70"
                    : "border-border/80 bg-card/85"
                )}
                key={participant.id}
              >
                <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background text-[10px] font-semibold uppercase text-foreground">
                  {initialsFromName(participant.displayName)}
                </span>
                <span className="truncate text-foreground">
                  {participant.displayName}
                  {participant.isCurrentUser ? " (You)" : ""}
                </span>
                <span
                  className={cn(
                    "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                    roleBadgeClassName(participant.role)
                  )}
                >
                  {formatRole(participant.role)}
                </span>
                <span
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={presenceCopy(participant.presence)}
                >
                  <span
                    className={cn(
                      "inline-flex size-1.5 rounded-full",
                      presenceDotClassName(participant.presence)
                    )}
                  />
                  {presenceCopy(participant.presence)}
                </span>
              </div>
            ))}

            {hiddenParticipantsCount > 0 ? (
              <span className="rounded-full border border-border/80 bg-card/80 px-2 py-1 text-xs text-muted-foreground">
                +{hiddenParticipantsCount} more
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
