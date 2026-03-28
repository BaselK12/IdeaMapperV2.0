import type { User } from "@supabase/supabase-js"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { XYPosition } from "reactflow"

import { supabase } from "@/lib/supabase"

const CURSOR_BROADCAST_FPS = 24
const CURSOR_STALE_AFTER_MS = 10000
const NODE_DRAG_BROADCAST_FPS = 20
const NODE_DRAG_STALE_AFTER_MS = 5000
const REALTIME_STALE_SWEEP_MS = 3000

const PRESENCE_COLORS = [
  "#FF5733",
  "#33FF57",
  "#3357FF",
  "#FF33A8",
  "#A833FF",
  "#33FFF5",
  "#FFC233",
  "#FF3333",
  "#33FF8E",
  "#8E33FF",
  "#FF8E33",
  "#33A8FF",
  "#57FF33",
]

type UseMapWorkspaceLiveCursorsParams = {
  currentUser: User
  mapId: string
}

type CursorPayload = {
  color: string
  ts: number
  userId: string
  username: string
  x: number
  y: number
}

type RemoteCursorState = CursorPayload & {
  lastSeenAt: number
}

type RawCursorPayload = Partial<Record<keyof CursorPayload, unknown>>
type NodeMovePhase = "drag" | "end"

type NodeMovePayload = {
  color?: string
  nodeId: string
  phase?: NodeMovePhase
  ts: number
  userId: string
  username?: string
  x?: number
  y?: number
}

type RemoteNodeDragState = {
  color: string
  lastSeenAt: number
  nodeId: string
  ts: number
  userId: string
  username: string
  x: number
  y: number
}

type RawNodeMovePayload = Partial<Record<keyof NodeMovePayload, unknown>>

export type MapWorkspaceLiveCursor = CursorPayload
export type MapWorkspaceRemoteNodeDrag = Omit<RemoteNodeDragState, "lastSeenAt">
export type MapWorkspaceRealtimeStatus = "connecting" | "live" | "offline"

type UseMapWorkspaceLiveCursorsResult = {
  endNodeDrag: (nodeId: string) => void
  isRealtimeAvailable: boolean
  realtimeStatus: MapWorkspaceRealtimeStatus
  remoteCursors: MapWorkspaceLiveCursor[]
  remoteNodeDrags: MapWorkspaceRemoteNodeDrag[]
  sendCursorPosition: (position: XYPosition) => void
  sendNodeDragPosition: (nodeId: string, position: XYPosition) => void
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function colorFromUserId(userId: string) {
  if (!userId) {
    return "#0EA5E9"
  }

  let hash = 0
  for (let index = 0; index < userId.length; index += 1) {
    hash = (hash * 31 + userId.charCodeAt(index)) >>> 0
  }

  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]
}

function normalizePresenceColor(value: unknown, userId: string) {
  const normalizedColor = normalizeOptionalText(value)
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(normalizedColor)) {
    return normalizedColor
  }

  return colorFromUserId(userId)
}

function getCurrentUserDisplayName(currentUser: User) {
  const metadata = currentUser.user_metadata
  const preferredMetadataKeys = ["username", "full_name", "name"]

  for (const key of preferredMetadataKeys) {
    const value = normalizeOptionalText(metadata?.[key])
    if (value) {
      return value
    }
  }

  const emailName = normalizeOptionalText(currentUser.email?.split("@")[0])
  if (emailName) {
    return emailName
  }

  return "You"
}

function toFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function normalizeNodeMovePhase(value: unknown): NodeMovePhase | null {
  if (value === "drag" || value === "end") {
    return value
  }

  return null
}

function pruneCursorMap(
  currentCursors: Record<string, RemoteCursorState>,
  now: number,
  presentUserIds: Set<string>
) {
  let didChange = false
  const nextCursors: Record<string, RemoteCursorState> = {}

  for (const [userId, cursor] of Object.entries(currentCursors)) {
    const isMissingFromPresence =
      presentUserIds.size > 0 && !presentUserIds.has(userId)
    const isStale = now - cursor.lastSeenAt > CURSOR_STALE_AFTER_MS

    if (isMissingFromPresence || isStale) {
      didChange = true
      continue
    }

    nextCursors[userId] = cursor
  }

  return didChange ? nextCursors : currentCursors
}

function pruneNodeDragMap(
  currentNodeDrags: Record<string, RemoteNodeDragState>,
  now: number,
  presentUserIds: Set<string>
) {
  let didChange = false
  const nextNodeDrags: Record<string, RemoteNodeDragState> = {}

  for (const [nodeId, nodeDrag] of Object.entries(currentNodeDrags)) {
    const isMissingFromPresence =
      presentUserIds.size > 0 && !presentUserIds.has(nodeDrag.userId)
    const isStale = now - nodeDrag.lastSeenAt > NODE_DRAG_STALE_AFTER_MS

    if (isMissingFromPresence || isStale) {
      didChange = true
      continue
    }

    nextNodeDrags[nodeId] = nodeDrag
  }

  return didChange ? nextNodeDrags : currentNodeDrags
}

export function useMapWorkspaceLiveCursors({
  currentUser,
  mapId,
}: UseMapWorkspaceLiveCursorsParams): UseMapWorkspaceLiveCursorsResult {
  const [isRealtimeAvailable, setIsRealtimeAvailable] = useState(false)
  const [realtimeStatus, setRealtimeStatus] =
    useState<MapWorkspaceRealtimeStatus>("connecting")
  const [remoteCursorByUserId, setRemoteCursorByUserId] = useState<
    Record<string, RemoteCursorState>
  >({})
  const [remoteNodeDragByNodeId, setRemoteNodeDragByNodeId] = useState<
    Record<string, RemoteNodeDragState>
  >({})

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const presentUserIdsRef = useRef(new Set<string>())
  const lastCursorSentAtRef = useRef(0)
  const lastNodeDragSentAtRef = useRef(0)
  const localDraggingNodeIdsRef = useRef(new Set<string>())

  const currentUserId = currentUser.id
  const currentUsername = useMemo(
    () => getCurrentUserDisplayName(currentUser),
    [currentUser]
  )
  const currentColor = useMemo(() => colorFromUserId(currentUserId), [currentUserId])

  useEffect(() => {
    presentUserIdsRef.current = new Set()
    localDraggingNodeIdsRef.current = new Set()
    setRemoteCursorByUserId({})
    setRemoteNodeDragByNodeId({})
    setIsRealtimeAvailable(false)
    setRealtimeStatus("connecting")
    lastCursorSentAtRef.current = 0
    lastNodeDragSentAtRef.current = 0

    const channel = supabase.channel(`map:${mapId}`, {
      config: { presence: { key: currentUserId } },
    })
    channelRef.current = channel

    const syncPresence = () => {
      const state = channel.presenceState() as Record<
        string,
        Array<{ userId?: unknown }>
      >
      const presentUserIds = new Set<string>()

      for (const metadataList of Object.values(state)) {
        for (const metadata of metadataList) {
          const userId = normalizeOptionalText(metadata?.userId)
          if (!userId || userId === currentUserId) {
            continue
          }

          presentUserIds.add(userId)
        }
      }

      presentUserIdsRef.current = presentUserIds

      setRemoteCursorByUserId((currentCursors) => {
        let didChange = false
        const nextCursors: Record<string, RemoteCursorState> = {}

        for (const [userId, cursor] of Object.entries(currentCursors)) {
          if (!presentUserIds.has(userId)) {
            didChange = true
            continue
          }

          nextCursors[userId] = cursor
        }

        return didChange ? nextCursors : currentCursors
      })

      setRemoteNodeDragByNodeId((currentNodeDrags) => {
        let didChange = false
        const nextNodeDrags: Record<string, RemoteNodeDragState> = {}

        for (const [nodeId, nodeDrag] of Object.entries(currentNodeDrags)) {
          if (!presentUserIds.has(nodeDrag.userId)) {
            didChange = true
            continue
          }

          nextNodeDrags[nodeId] = nodeDrag
        }

        return didChange ? nextNodeDrags : currentNodeDrags
      })
    }

    const markRealtimeUnavailable = () => {
      setRealtimeStatus("offline")
      setIsRealtimeAvailable(false)
      setRemoteCursorByUserId({})
      setRemoteNodeDragByNodeId({})
    }

    const markRealtimeConnecting = () => {
      setRealtimeStatus("connecting")
      setIsRealtimeAvailable(false)
      setRemoteCursorByUserId({})
      setRemoteNodeDragByNodeId({})
    }

    channel.on("presence", { event: "sync" }, syncPresence)
    channel.on("presence", { event: "join" }, syncPresence)
    channel.on("presence", { event: "leave" }, syncPresence)
    channel.on("broadcast", { event: "cursor" }, ({ payload }) => {
      const rawPayload =
        payload && typeof payload === "object"
          ? (payload as RawCursorPayload)
          : null
      if (!rawPayload) {
        return
      }

      const userId = normalizeOptionalText(rawPayload.userId)
      if (!userId || userId === currentUserId) {
        return
      }

      const x = toFiniteNumber(rawPayload.x)
      const y = toFiniteNumber(rawPayload.y)
      if (x === null || y === null) {
        return
      }

      const username = normalizeOptionalText(rawPayload.username) || "Member"
      const color = normalizePresenceColor(rawPayload.color, userId)
      const payloadTs = toFiniteNumber(rawPayload.ts)
      const now = Date.now()

      setRemoteCursorByUserId((currentCursors) => ({
        ...currentCursors,
        [userId]: {
          color,
          lastSeenAt: now,
          ts: payloadTs ?? now,
          userId,
          username,
          x,
          y,
        },
      }))
    })
    channel.on("broadcast", { event: "node-move" }, ({ payload }) => {
      const rawPayload =
        payload && typeof payload === "object"
          ? (payload as RawNodeMovePayload)
          : null
      if (!rawPayload) {
        return
      }

      const userId = normalizeOptionalText(rawPayload.userId)
      if (!userId || userId === currentUserId) {
        return
      }

      const nodeId = normalizeOptionalText(rawPayload.nodeId)
      if (!nodeId) {
        return
      }

      const phase = normalizeNodeMovePhase(rawPayload.phase) ?? "drag"
      if (phase === "end") {
        setRemoteNodeDragByNodeId((currentNodeDrags) => {
          const currentNodeDrag = currentNodeDrags[nodeId]
          if (!currentNodeDrag || currentNodeDrag.userId !== userId) {
            return currentNodeDrags
          }

          const { [nodeId]: _removedNodeDrag, ...nextNodeDrags } =
            currentNodeDrags
          return nextNodeDrags
        })
        return
      }

      if (localDraggingNodeIdsRef.current.has(nodeId)) {
        return
      }

      const x = toFiniteNumber(rawPayload.x)
      const y = toFiniteNumber(rawPayload.y)
      if (x === null || y === null) {
        return
      }

      const username = normalizeOptionalText(rawPayload.username) || "Member"
      const color = normalizePresenceColor(rawPayload.color, userId)
      const payloadTs = toFiniteNumber(rawPayload.ts)
      const now = Date.now()

      setRemoteNodeDragByNodeId((currentNodeDrags) => ({
        ...currentNodeDrags,
        [nodeId]: {
          color,
          lastSeenAt: now,
          nodeId,
          ts: payloadTs ?? now,
          userId,
          username,
          x,
          y,
        },
      }))
    })

    const staleSweepTimer = window.setInterval(() => {
      const now = Date.now()
      const presentUserIds = presentUserIdsRef.current
      setRemoteCursorByUserId((currentCursors) =>
        pruneCursorMap(currentCursors, now, presentUserIds)
      )
      setRemoteNodeDragByNodeId((currentNodeDrags) =>
        pruneNodeDragMap(currentNodeDrags, now, presentUserIds)
      )
    }, REALTIME_STALE_SWEEP_MS)

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setRealtimeStatus("live")
        setIsRealtimeAvailable(true)

        try {
          await channel.track({
            color: currentColor,
            userId: currentUserId,
            username: currentUsername,
          })
          syncPresence()
        } catch (error) {
          console.warn("[V3] Cursor presence track failed:", error)
        }

        return
      }

      if (status === "CHANNEL_ERROR") {
        markRealtimeUnavailable()
        return
      }

      if (status === "TIMED_OUT" || status === "CLOSED") {
        markRealtimeConnecting()
      }
    })

    return () => {
      window.clearInterval(staleSweepTimer)
      presentUserIdsRef.current = new Set()
      localDraggingNodeIdsRef.current = new Set()

      try {
        void channel.untrack()
      } catch (error) {
        console.warn("[V3] Cursor presence untrack failed:", error)
      }

      void supabase.removeChannel(channel)

      if (channelRef.current === channel) {
        channelRef.current = null
      }
    }
  }, [currentColor, currentUserId, currentUsername, mapId])

  const sendCursorPosition = useCallback(
    (position: XYPosition) => {
      if (
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        return
      }

      const channel = channelRef.current
      if (!channel) {
        return
      }

      const now = performance.now()
      const minInterval = 1000 / CURSOR_BROADCAST_FPS
      if (now - lastCursorSentAtRef.current < minInterval) {
        return
      }

      lastCursorSentAtRef.current = now

      void channel
        .send({
          event: "cursor",
          payload: {
            color: currentColor,
            ts: Date.now(),
            userId: currentUserId,
            username: currentUsername,
            x: position.x,
            y: position.y,
          },
          type: "broadcast",
        })
        .then((result) => {
          if (result !== "ok") {
            setRealtimeStatus("offline")
            setIsRealtimeAvailable(false)
            return
          }

          setRealtimeStatus("live")
          setIsRealtimeAvailable(true)
        })
        .catch(() => {
          setRealtimeStatus("offline")
          setIsRealtimeAvailable(false)
        })
    },
    [currentColor, currentUserId, currentUsername]
  )

  const sendNodeDragPosition = useCallback(
    (nodeId: string, position: XYPosition) => {
      if (
        !Number.isFinite(position.x) ||
        !Number.isFinite(position.y)
      ) {
        return
      }

      const normalizedNodeId = normalizeOptionalText(nodeId)
      if (!normalizedNodeId) {
        return
      }

      const channel = channelRef.current
      if (!channel) {
        return
      }

      const now = performance.now()
      const minInterval = 1000 / NODE_DRAG_BROADCAST_FPS
      if (now - lastNodeDragSentAtRef.current < minInterval) {
        return
      }

      lastNodeDragSentAtRef.current = now
      localDraggingNodeIdsRef.current.add(normalizedNodeId)

      setRemoteNodeDragByNodeId((currentNodeDrags) => {
        if (!currentNodeDrags[normalizedNodeId]) {
          return currentNodeDrags
        }

        const { [normalizedNodeId]: _removedNodeDrag, ...nextNodeDrags } =
          currentNodeDrags
        return nextNodeDrags
      })

      void channel
        .send({
          event: "node-move",
          payload: {
            color: currentColor,
            nodeId: normalizedNodeId,
            phase: "drag",
            ts: Date.now(),
            userId: currentUserId,
            username: currentUsername,
            x: position.x,
            y: position.y,
          },
          type: "broadcast",
        })
        .then((result) => {
          if (result !== "ok") {
            setRealtimeStatus("offline")
            setIsRealtimeAvailable(false)
            return
          }

          setRealtimeStatus("live")
          setIsRealtimeAvailable(true)
        })
        .catch(() => {
          setRealtimeStatus("offline")
          setIsRealtimeAvailable(false)
        })
    },
    [currentColor, currentUserId, currentUsername]
  )

  const endNodeDrag = useCallback(
    (nodeId: string) => {
      const normalizedNodeId = normalizeOptionalText(nodeId)
      if (!normalizedNodeId) {
        return
      }

      localDraggingNodeIdsRef.current.delete(normalizedNodeId)

      const channel = channelRef.current
      if (!channel) {
        return
      }

      void channel
        .send({
          event: "node-move",
          payload: {
            nodeId: normalizedNodeId,
            phase: "end",
            ts: Date.now(),
            userId: currentUserId,
          },
          type: "broadcast",
        })
        .then((result) => {
          if (result !== "ok") {
            setRealtimeStatus("offline")
            setIsRealtimeAvailable(false)
            return
          }

          setRealtimeStatus("live")
          setIsRealtimeAvailable(true)
        })
        .catch(() => {
          setRealtimeStatus("offline")
          setIsRealtimeAvailable(false)
        })
    },
    [currentUserId]
  )

  const remoteCursors = useMemo(
    () =>
      Object.values(remoteCursorByUserId).map((cursor) => ({
        color: cursor.color,
        ts: cursor.ts,
        userId: cursor.userId,
        username: cursor.username,
        x: cursor.x,
        y: cursor.y,
      })),
    [remoteCursorByUserId]
  )

  const remoteNodeDrags = useMemo(
    () =>
      Object.values(remoteNodeDragByNodeId).map((nodeDrag) => ({
        color: nodeDrag.color,
        nodeId: nodeDrag.nodeId,
        ts: nodeDrag.ts,
        userId: nodeDrag.userId,
        username: nodeDrag.username,
        x: nodeDrag.x,
        y: nodeDrag.y,
      })),
    [remoteNodeDragByNodeId]
  )

  return {
    endNodeDrag,
    isRealtimeAvailable,
    realtimeStatus,
    remoteCursors,
    remoteNodeDrags,
    sendCursorPosition,
    sendNodeDragPosition,
  }
}
