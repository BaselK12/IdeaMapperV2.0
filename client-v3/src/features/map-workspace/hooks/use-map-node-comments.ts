import { useCallback, useEffect, useRef, useState } from "react"

import {
  fetchMapNodeCommentThreads,
  normalizeMapNodeCommentThreads,
  updateMapNodeCommentThreads,
} from "@/features/map-workspace/api/map-node-comments-api"
import type {
  MapNodeCommentMention,
  MapNodeCommentThreads,
} from "@/features/map-workspace/types/map-node-comments-types"
import { createNotificationForUser } from "@/features/notifications/api/notifications-api"
import { supabase } from "@/lib/supabase"

type UseMapNodeCommentsParams = {
  mapId: string
  mapName: string
}

type AddMapNodeCommentParams = {
  authorId: string
  authorName: string
  body: string
  mentions: MapNodeCommentMention[]
  nodeId: string
}

type SetMapNodeThreadResolvedParams = {
  actorId: string
  actorName: string
  isResolved: boolean
  nodeId: string
}

function createRuntimeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function normalizeMentions(mentions: MapNodeCommentMention[]) {
  const mentionByUserId = new Map<string, MapNodeCommentMention>()

  for (const mention of mentions) {
    const userId = mention.userId.trim()
    const displayName = mention.displayName.trim()
    if (!userId || !displayName || mentionByUserId.has(userId)) {
      continue
    }

    mentionByUserId.set(userId, {
      displayName,
      userId,
    })
  }

  return Array.from(mentionByUserId.values())
}

export function useMapNodeComments({ mapId, mapName }: UseMapNodeCommentsParams) {
  const [threads, setThreads] = useState<MapNodeCommentThreads>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const sessionRef = useRef(0)
  const threadsRef = useRef<MapNodeCommentThreads>({})

  useEffect(() => {
    threadsRef.current = threads
  }, [threads])

  const applyThreads = useCallback((nextThreads: MapNodeCommentThreads) => {
    threadsRef.current = nextThreads
    setThreads(nextThreads)
  }, [])

  const loadThreads = useCallback(
    async (sessionId = sessionRef.current) => {
      setErrorMessage(null)

      try {
        const nextThreads = await fetchMapNodeCommentThreads(mapId)
        if (sessionRef.current !== sessionId) {
          return
        }

        applyThreads(nextThreads)
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          return
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load node comments."
        )
      } finally {
        if (sessionRef.current === sessionId) {
          setIsLoading(false)
        }
      }
    },
    [applyThreads, mapId]
  )

  const persistThreads = useCallback(
    async (nextThreads: MapNodeCommentThreads) => {
      const sessionId = sessionRef.current

      setIsSaving(true)
      setErrorMessage(null)

      try {
        const result = await updateMapNodeCommentThreads({
          mapId,
          threads: nextThreads,
        })
        if (sessionRef.current !== sessionId) {
          return false
        }

        applyThreads(result.threads)
        return true
      } catch (error) {
        if (sessionRef.current !== sessionId) {
          return false
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to update node comments."
        )
        return false
      } finally {
        if (sessionRef.current === sessionId) {
          setIsSaving(false)
        }
      }
    },
    [applyThreads, mapId]
  )

  useEffect(() => {
    sessionRef.current += 1
    const sessionId = sessionRef.current

    applyThreads({})
    setErrorMessage(null)
    setIsLoading(true)
    setIsSaving(false)

    void loadThreads(sessionId)

    const channel = supabase
      .channel(`map-node-comments-${mapId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", filter: `id=eq.${mapId}`, schema: "public", table: "maps" },
        (payload) => {
          if (sessionRef.current !== sessionId) {
            return
          }

          const row = payload.new
          if (!row || typeof row !== "object") {
            return
          }

          const nextThreads = normalizeMapNodeCommentThreads(
            (row as { node_notes?: unknown }).node_notes
          )
          applyThreads(nextThreads)
        }
      )

    channel.subscribe((status) => {
      if (sessionRef.current !== sessionId) {
        return
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setErrorMessage(
          "Live comment updates are unavailable. Reload the page to reconnect."
        )
      }
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applyThreads, loadThreads, mapId])

  const addComment = useCallback(
    async (params: AddMapNodeCommentParams) => {
      const nextBody = params.body.trim()
      if (!nextBody) {
        return false
      }

      const currentThread = threadsRef.current[params.nodeId]
      const nextThreads = {
        ...threadsRef.current,
        [params.nodeId]: {
          comments: [
            ...(currentThread?.comments ?? []),
            {
              authorId: params.authorId.trim(),
              authorName: params.authorName.trim(),
              body: nextBody,
              createdAt: new Date().toISOString(),
              id: createRuntimeId("comment"),
              mentions: normalizeMentions(params.mentions),
            },
          ],
          isResolved: false,
          resolvedAt: null,
          resolvedById: null,
          resolvedByName: null,
        },
      } satisfies MapNodeCommentThreads

      const saved = await persistThreads(nextThreads)
      if (saved && params.mentions.length > 0) {
        for (const mention of normalizeMentions(params.mentions)) {
          void createNotificationForUser({
            data: {
              authorName: params.authorName.trim(),
              commentSnippet: nextBody.slice(0, 120),
              mapName,
            },
            mapId,
            type: "mention",
            userId: mention.userId,
          })
        }
      }
      return saved
    },
    [mapId, mapName, persistThreads]
  )

  const setThreadResolved = useCallback(
    async (params: SetMapNodeThreadResolvedParams) => {
      const currentThread = threadsRef.current[params.nodeId]
      if (!currentThread || currentThread.comments.length === 0) {
        return false
      }

      const nextThreads = {
        ...threadsRef.current,
        [params.nodeId]: {
          ...currentThread,
          isResolved: params.isResolved,
          resolvedAt: params.isResolved ? new Date().toISOString() : null,
          resolvedById: params.isResolved ? params.actorId.trim() : null,
          resolvedByName: params.isResolved ? params.actorName.trim() : null,
        },
      } satisfies MapNodeCommentThreads

      return persistThreads(nextThreads)
    },
    [persistThreads]
  )

  const retryLoad = useCallback(() => {
    setIsLoading(true)
    void loadThreads(sessionRef.current)
  }, [loadThreads])

  return {
    addComment,
    errorMessage,
    isLoading,
    isSaving,
    retryLoad,
    setThreadResolved,
    threads,
  }
}
