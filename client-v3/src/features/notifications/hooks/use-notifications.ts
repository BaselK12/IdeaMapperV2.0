import { useCallback, useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"

import { supabase } from "@/lib/supabase"
import {
  fetchNotifications,
  markNotificationsRead,
} from "@/features/notifications/api/notifications-api"
import type { Notification } from "@/features/notifications/types/notification-types"

type UseNotificationsParams = {
  user: User | null
}

export function useNotifications({ user }: UseNotificationsParams) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const sessionRef = useRef(0)

  const load = useCallback(async () => {
    if (!user) return
    const sessionId = (sessionRef.current += 1)
    setIsLoading(true)
    try {
      const result = await fetchNotifications(user.id)
      if (sessionRef.current !== sessionId) return
      setNotifications(result)
    } catch {
      // notifications are best-effort; silently degrade
    } finally {
      if (sessionRef.current === sessionId) setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!user) return

    const sessionId = sessionRef.current

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          filter: `user_id=eq.${user.id}`,
          schema: "public",
          table: "notifications",
        },
        (payload) => {
          if (sessionRef.current !== sessionId) return

          const row = payload.new
          if (!row || typeof row !== "object") return

          const r = row as Record<string, unknown>
          const id = typeof r.id === "string" ? r.id : null
          const type = r.type

          if (!id || typeof type !== "string") return

          const incoming: Notification = {
            createdAt:
              typeof r.created_at === "string" ? r.created_at : new Date().toISOString(),
            data:
              typeof r.data === "object" && r.data !== null && !Array.isArray(r.data)
                ? (r.data as Record<string, unknown>)
                : {},
            id,
            mapId: typeof r.map_id === "string" ? r.map_id : null,
            readAt: null,
            type: type as Notification["type"],
            userId: user.id,
          }

          setNotifications((prev) => [incoming, ...prev].slice(0, 40))
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user])

  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const readAt = new Date().toISOString()
    setNotifications((prev) =>
      prev.map((n) => (ids.includes(n.id) ? { ...n, readAt } : n))
    )
    try {
      await markNotificationsRead(ids)
    } catch {
      // optimistic update stays; next load will self-correct
    }
  }, [])

  const markAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.readAt).map((n) => n.id)
    await markRead(unreadIds)
  }, [markRead, notifications])

  const unreadCount = notifications.filter((n) => !n.readAt).length

  return {
    isLoading,
    markAllRead,
    markRead,
    notifications,
    unreadCount,
  }
}
