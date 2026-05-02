import { useEffect, useRef, useState } from "react"
import { Bell, BellDot, CheckCheck, ExternalLink, X } from "lucide-react"
import { Link } from "react-router-dom"
import type { User } from "@supabase/supabase-js"

import { cn } from "@/lib/utils"
import { useNotifications } from "@/features/notifications/hooks/use-notifications"
import type { Notification } from "@/features/notifications/types/notification-types"

type NotificationBellProps = {
  user: User | null
}

function formatRelativeTime(isoString: string) {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function getNotificationText(notification: Notification): string {
  const d = notification.data
  if (notification.type === "mention") {
    const author = typeof d.authorName === "string" ? d.authorName : "Someone"
    const mapName = typeof d.mapName === "string" ? d.mapName : "a map"
    return `${author} mentioned you in ${mapName}.`
  }
  if (notification.type === "role_changed") {
    const role = typeof d.newRole === "string" ? d.newRole : "a new role"
    const mapName = typeof d.mapName === "string" ? d.mapName : "a map"
    return `Your role on ${mapName} was updated to ${role}.`
  }
  if (notification.type === "map_invite_accepted") {
    const name = typeof d.inviteeName === "string" ? d.inviteeName : "Someone"
    const mapName = typeof d.mapName === "string" ? d.mapName : "your map"
    return `${name} accepted your invite to ${mapName}.`
  }
  return "New notification."
}

function getNotificationLink(notification: Notification): string {
  return notification.mapId ? `/app/map/${notification.mapId}` : "/app"
}

export function NotificationBell({ user }: NotificationBellProps) {
  const { isLoading, markAllRead, markRead, notifications, unreadCount } =
    useNotifications({ user })

  const [isOpen, setIsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleOutside = (event: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleOutside)
    return () => document.removeEventListener("mousedown", handleOutside)
  }, [isOpen])

  const handleToggle = () => setIsOpen((prev) => !prev)

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.readAt) void markRead([notification.id])
    setIsOpen(false)
  }

  const BellIcon = unreadCount > 0 ? BellDot : Bell

  return (
    <div className="relative">
      <button
        aria-label={
          unreadCount > 0
            ? `Notifications (${unreadCount} unread)`
            : "Notifications"
        }
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground transition-colors hover:bg-primary-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isOpen && "bg-primary-soft text-foreground"
        )}
        onClick={handleToggle}
        ref={buttonRef}
        title="Notifications"
        type="button"
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className="absolute left-0 top-11 z-50 w-80 overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-xl"
          ref={panelRef}
        >
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <div className="flex items-center gap-1">
              {unreadCount > 0 ? (
                <button
                  className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                  onClick={() => void markAllRead()}
                  title="Mark all as read"
                  type="button"
                >
                  <CheckCheck className="size-3.5" />
                  Mark all read
                </button>
              ) : null}
              <button
                className="grid h-7 w-7 place-content-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Close notifications"
                type="button"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Loading...
              </p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notifications yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {notifications.map((notification) => (
                  <li
                    className={cn(
                      "relative",
                      !notification.readAt && "bg-primary-soft/25"
                    )}
                    key={notification.id}
                  >
                    <Link
                      className="block px-4 py-3 transition-colors hover:bg-muted/30"
                      onClick={() => handleNotificationClick(notification)}
                      to={getNotificationLink(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full">
                          {!notification.readAt ? (
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground">
                            {getNotificationText(notification)}
                          </p>
                          {notification.type === "mention" &&
                          typeof notification.data.commentSnippet === "string" ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              &ldquo;{notification.data.commentSnippet}&rdquo;
                            </p>
                          ) : null}
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatRelativeTime(notification.createdAt)}
                          </p>
                        </div>
                        <ExternalLink className="mt-1 size-3.5 shrink-0 text-muted-foreground/60" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
