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

const DEFAULT_VISIBLE_PARTICIPANTS = 6
const COMPACT_VISIBLE_PARTICIPANTS = 8
const COMPACT_THRESHOLD = 5
const infoStatusClassName =
  "border-[hsl(var(--info-border))] bg-[hsl(var(--info-soft))] text-[hsl(var(--info-foreground))]"
const warningStatusClassName =
  "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))]"

function roleBadgeClassName(role: string) {
  const normalizedRole = role.trim().toLowerCase()

  if (normalizedRole === "admin" || normalizedRole === "owner") {
    return "border-primary/25 bg-primary-soft/80 text-primary"
  }

  if (normalizedRole === "editor" || normalizedRole === "member") {
    return infoStatusClassName
  }

  return "border-border/80 bg-muted/70 text-muted-foreground"
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

  return "Unknown status"
}

function presenceDotClassName(presence: MapWorkspaceParticipantPresence) {
  if (presence === "online") {
    return "bg-[hsl(var(--success-foreground))]"
  }

  if (presence === "offline") {
    return "bg-muted-foreground/70"
  }

  return "bg-[hsl(var(--warning-foreground))]"
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
  const isCompact = participants.length >= COMPACT_THRESHOLD
  const maxVisibleParticipants = isCompact
    ? COMPACT_VISIBLE_PARTICIPANTS
    : DEFAULT_VISIBLE_PARTICIPANTS
  const visibleParticipants = participants.slice(0, maxVisibleParticipants)
  const hiddenParticipants = participants.slice(visibleParticipants.length)
  const hiddenParticipantsCount = Math.max(
    0,
    participants.length - maxVisibleParticipants
  )
  const onlineCount = participants.filter(
    (participant) => participant.presence === "online"
  ).length
  const offlineCount = participants.filter(
    (participant) => participant.presence === "offline"
  ).length
  const unknownCount = participants.filter(
    (participant) => participant.presence === "unknown"
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
  const hiddenParticipantsTitle = hiddenParticipants
    .map((participant) => `${participant.displayName} (${presenceCopy(participant.presence)})`)
    .join(" • ")

  return (
    <section className="rounded-xl border border-border/80 bg-card/90 px-3 py-2 md:px-3.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground md:text-[11px]">
            Participants
          </p>
          {isLoading ? (
            <span className="h-4.5 w-24 animate-pulse rounded-full bg-muted" />
          ) : (
            <span className="rounded-full border border-border/70 bg-card/90 px-1.5 py-0.5 text-[10px] text-muted-foreground md:text-[11px]">
              {onlineCount} online • {offlineCount} offline
              {unknownCount > 0 ? ` • ${unknownCount} unknown` : ""}
            </span>
          )}
        </div>

        {isPresenceUnavailable ? (
          <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] md:text-[11px]", warningStatusClassName)}>
            Presence delayed
          </span>
        ) : null}
      </div>

      {isLoading && participants.length === 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <div className="h-7 w-40 animate-pulse rounded-full bg-muted/85" />
          <div className="h-7 w-32 animate-pulse rounded-full bg-muted/70" />
          <div className="h-7 w-24 animate-pulse rounded-full bg-muted/60" />
        </div>
      ) : (
        <>
          {errorMessage ? (
            <div className={cn("mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-1.5", warningStatusClassName)}>
              <p className="text-[11px]">
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
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Only you are online right now.
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {visibleParticipants.map((participant) => (
              <div
                className={cn(
                  "inline-flex max-w-full items-center gap-1.5 rounded-full border px-1.5 py-1 text-[11px]",
                  isCompact ? "pr-1.5" : "pr-2",
                  participant.isCurrentUser
                    ? "border-primary/30 bg-primary-soft/80"
                    : "border-border/80 bg-card/95"
                )}
                key={participant.id}
              >
                <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border/70 bg-background/95 text-[9px] font-semibold uppercase text-foreground">
                  {initialsFromName(participant.displayName)}
                </span>
                <span className="inline-flex max-w-[7rem] items-center gap-1 text-foreground">
                  <span className="truncate">{participant.displayName}</span>
                  {participant.isCurrentUser ? (
                    <span className="rounded-full border border-primary/30 bg-primary-soft/80 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                      You
                    </span>
                  ) : null}
                </span>
                {!isCompact || participant.isCurrentUser ? (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-medium",
                      roleBadgeClassName(participant.role)
                    )}
                  >
                    {formatRole(participant.role)}
                  </span>
                ) : null}
                <span
                  className="inline-flex items-center gap-1 text-[9px] text-muted-foreground"
                  title={presenceCopy(participant.presence)}
                >
                  <span
                    className={cn(
                      "inline-flex size-1.5 rounded-full",
                      presenceDotClassName(participant.presence)
                    )}
                  />
                  <span className={cn(isCompact && !participant.isCurrentUser ? "hidden sm:inline" : "")}>
                    {presenceCopy(participant.presence)}
                  </span>
                </span>
              </div>
            ))}

            {hiddenParticipantsCount > 0 ? (
              <span
                className="rounded-full border border-border/80 bg-card/95 px-1.5 py-0.5 text-[11px] text-muted-foreground"
                title={hiddenParticipantsTitle}
              >
                +{hiddenParticipantsCount} more
              </span>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}
