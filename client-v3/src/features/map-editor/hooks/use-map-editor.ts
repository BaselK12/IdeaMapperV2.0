import { useQuery } from "@tanstack/react-query"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from "react"
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
  type XYPosition,
} from "reactflow"

import {
  fetchMapEditorGraphById,
  MapEditorSaveError,
  saveMapEditorGraphById,
} from "@/features/map-editor/api/map-editor-api"
import { instantiateBranchStarterGraph } from "@/features/maps/api/map-presets"
import type { BuiltInBranchStarter } from "@/features/maps/types/maps-types"
import { supabase } from "@/lib/supabase"
import type {
  MapEditorEdge,
  MapEditorNode,
  MapEditorNodeColor,
  MapEditorNodeKind,
  MapEditorNodeMedia,
  MapEditorSaveStatus,
  MapEditorSyncStatus,
  SelectedEdgeSummary,
  SelectedNodeSummary,
} from "@/features/map-editor/types/map-editor-types"
import {
  createGraphSignature,
  createNewNode,
  filterEdgesByExistingNodes,
  getNodeTitleFromValue,
  normalizeLoadedEdges,
  normalizeLoadedNodes,
  normalizeNodeColor,
  normalizeNodeKind,
  normalizeNodeMedia,
  toRoleCanEdit,
} from "@/features/map-editor/utils/map-editor-graph"

type UseMapEditorParams = {
  mapId: string
  role: string
}

const SAVE_DEBOUNCE_MS = 700
const SELECTION_INVALIDATION_NOTICE_MS = 4800
const GRAPH_HISTORY_LIMIT = 40
const ORGANIZE_LAYOUT_ORIGIN = {
  x: 120,
  y: 140,
}
const ORGANIZE_COLUMN_GAP = 120
const ORGANIZE_ROW_GAP = 72

function getNodeLayoutSize(node: MapEditorNode) {
  const measuredNode = node as MapEditorNode & {
    measured?: {
      height?: number
      width?: number
    }
  }
  const measuredWidth =
    typeof measuredNode.measured?.width === "number"
      ? measuredNode.measured.width
      : typeof node.width === "number"
        ? node.width
        : null
  const measuredHeight =
    typeof measuredNode.measured?.height === "number"
      ? measuredNode.measured.height
      : typeof node.height === "number"
        ? node.height
        : null

  return {
    height:
      measuredHeight ??
      (node.data.media ? 212 : node.data.description?.trim() ? 124 : 88),
    width: measuredWidth ?? 280,
  }
}

type ReconciledGraphSelection = {
  edges: MapEditorEdge[]
  nodes: MapEditorNode[]
  selectedEdgeId: string | null
  selectedNodeId: string | null
}

type RemoteMapRow = {
  edges?: unknown
  id?: unknown
  last_edited?: unknown
  nodes?: unknown
}

type RemoteGraphSnapshot = {
  edges: MapEditorEdge[]
  lastEdited: string | null
  nodes: MapEditorNode[]
  signature: string
}

type GraphHistorySnapshot = {
  edges: MapEditorEdge[]
  nodes: MapEditorNode[]
  signature: string
}

function toSaveErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Could not save map changes."
}

function isPermissionLockError(error: unknown) {
  return (
    error instanceof MapEditorSaveError &&
    (error.code === "permission" || error.code === "rejected")
  )
}

function filterReadOnlyNodeChanges(changes: NodeChange[]) {
  return changes.filter(
    (change) => change.type === "select" || change.type === "dimensions"
  )
}

function filterReadOnlyEdgeChanges(changes: EdgeChange[]) {
  return changes.filter((change) => change.type === "select")
}

function hasPersistableNodeChanges(changes: NodeChange[]) {
  return changes.some(
    (change) => change.type !== "select" && change.type !== "dimensions"
  )
}

function hasPersistableEdgeChanges(changes: EdgeChange[]) {
  return changes.some((change) => change.type !== "select")
}

function toIsoStringOrNull(value: unknown) {
  if (typeof value !== "string") {
    return null
  }

  const nextValue = value.trim()
  if (!nextValue) {
    return null
  }

  return nextValue
}

function toSyncErrorMessage(status: string) {
  if (status === "CHANNEL_ERROR") {
    return "Realtime sync connection failed. Trying to reconnect."
  }

  if (status === "TIMED_OUT") {
    return "Realtime sync timed out. Trying to reconnect."
  }

  if (status === "CLOSED") {
    return "Realtime sync disconnected."
  }

  return "Realtime sync is unavailable right now."
}

function toSelectionInvalidationMessage(params: {
  nextSelectedEdgeId: string | null
  nextSelectedNodeId: string | null
  previousSelectedEdgeId: string | null
  previousSelectedNodeId: string | null
}) {
  const {
    nextSelectedEdgeId,
    nextSelectedNodeId,
    previousSelectedEdgeId,
    previousSelectedNodeId,
  } = params

  if (previousSelectedNodeId && !nextSelectedNodeId) {
    return "The selected node was removed in another session."
  }

  if (
    previousSelectedEdgeId &&
    !previousSelectedNodeId &&
    !nextSelectedEdgeId
  ) {
    return "The selected connection was removed in another session."
  }

  return null
}

function cloneGraph(nodes: MapEditorNode[], edges: MapEditorEdge[]) {
  return {
    edges: edges.map((edge) => ({
      ...edge,
      data: edge.data ? { ...edge.data } : edge.data,
      style: edge.style ? { ...edge.style } : edge.style,
    })),
    nodes: nodes.map((node) => ({
      ...node,
      data: { ...node.data },
      position: { ...node.position },
      style: node.style ? { ...node.style } : node.style,
    })),
  }
}

function createHistorySnapshot(
  nodes: MapEditorNode[],
  edges: MapEditorEdge[]
): GraphHistorySnapshot {
  const snapshot = cloneGraph(nodes, edges)

  return {
    ...snapshot,
    signature: createGraphSignature(snapshot.nodes, snapshot.edges),
  }
}

function getEdgeTextField(value: unknown) {
  return typeof value === "string" ? value : ""
}

function reconcileSelection(
  nodes: MapEditorNode[],
  edges: MapEditorEdge[],
  selectedNodeId: string | null,
  selectedEdgeId: string | null
): ReconciledGraphSelection {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const edgeIds = new Set(edges.map((edge) => edge.id))

  const nextSelectedNodeId =
    selectedNodeId && nodeIds.has(selectedNodeId) ? selectedNodeId : null
  const nextSelectedEdgeId =
    nextSelectedNodeId ||
    !selectedEdgeId ||
    !edgeIds.has(selectedEdgeId)
      ? null
      : selectedEdgeId

  const nextNodes = nodes.map((node) => {
    const shouldSelect = nextSelectedNodeId === node.id
    if (Boolean(node.selected) === shouldSelect) {
      return node
    }

    return {
      ...node,
      selected: shouldSelect,
    }
  })

  const nextEdges = edges.map((edge) => {
    const shouldSelect = nextSelectedEdgeId === edge.id
    if (Boolean(edge.selected) === shouldSelect) {
      return edge
    }

    return {
      ...edge,
      selected: shouldSelect,
    }
  })

  return {
    edges: nextEdges,
    nodes: nextNodes,
    selectedEdgeId: nextSelectedEdgeId,
    selectedNodeId: nextSelectedNodeId,
  }
}

export function useMapEditor({ mapId, role }: UseMapEditorParams) {
  const roleCanEdit = useMemo(() => toRoleCanEdit(role), [role])
  const [isEditLocked, setIsEditLocked] = useState(false)
  const canEdit = roleCanEdit && !isEditLocked

  const [nodes, setNodes] = useState<MapEditorNode[]>([])
  const [edges, setEdges] = useState<MapEditorEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<MapEditorSaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [lastEdited, setLastEdited] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<MapEditorSyncStatus>("connecting")
  const [syncError, setSyncError] = useState<string | null>(null)
  const [hasRemoteUpdateAvailable, setHasRemoteUpdateAvailable] = useState(false)
  const [selectionInvalidationNotice, setSelectionInvalidationNotice] = useState<
    string | null
  >(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestNodesRef = useRef<MapEditorNode[]>([])
  const latestEdgesRef = useRef<MapEditorEdge[]>([])
  const selectedNodeIdRef = useRef<string | null>(null)
  const selectedEdgeIdRef = useRef<string | null>(null)
  const persistedSignatureRef = useRef("")
  const pendingRemoteGraphRef = useRef<RemoteGraphSnapshot | null>(null)
  const selectionInvalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  )
  const isHydratedRef = useRef(false)
  const isPersistingRef = useRef(false)
  const shouldPersistAgainRef = useRef(false)
  const editorSessionRef = useRef(0)
  const canEditRef = useRef(canEdit)
  const isMountedRef = useRef(true)
  const undoStackRef = useRef<GraphHistorySnapshot[]>([])
  const redoStackRef = useRef<GraphHistorySnapshot[]>([])

  const graphQuery = useQuery({
    enabled: Boolean(mapId),
    queryFn: async () => fetchMapEditorGraphById(mapId),
    queryKey: ["map-editor", "graph", mapId],
    refetchOnWindowFocus: false,
    retry: false,
  })

  const setSaveStatusSafe = useCallback(
    (nextStatus: SetStateAction<MapEditorSaveStatus>) => {
      if (!isMountedRef.current) {
        return
      }

      setSaveStatus(nextStatus)
    },
    []
  )

  const setSaveErrorSafe = useCallback(
    (nextError: SetStateAction<string | null>) => {
      if (!isMountedRef.current) {
        return
      }

      setSaveError(nextError)
    },
    []
  )

  const setSyncStatusSafe = useCallback(
    (nextStatus: SetStateAction<MapEditorSyncStatus>) => {
      if (!isMountedRef.current) {
        return
      }

      setSyncStatus(nextStatus)
    },
    []
  )

  const setSyncErrorSafe = useCallback(
    (nextError: SetStateAction<string | null>) => {
      if (!isMountedRef.current) {
        return
      }

      setSyncError(nextError)
    },
    []
  )

  const setLastEditedSafe = useCallback(
    (nextLastEdited: SetStateAction<string | null>) => {
      if (!isMountedRef.current) {
        return
      }

      setLastEdited(nextLastEdited)
    },
    []
  )

  const setHasRemoteUpdateAvailableSafe = useCallback(
    (nextValue: SetStateAction<boolean>) => {
      if (!isMountedRef.current) {
        return
      }

      setHasRemoteUpdateAvailable(nextValue)
    },
    []
  )

  const setSelectionInvalidationNoticeSafe = useCallback(
    (nextValue: SetStateAction<string | null>) => {
      if (!isMountedRef.current) {
        return
      }

      setSelectionInvalidationNotice(nextValue)
    },
    []
  )

  const bumpHistoryVersion = useCallback(() => {
    if (!isMountedRef.current) {
      return
    }

    setHistoryVersion((currentVersion) => currentVersion + 1)
  }, [])

  const clearGraphHistory = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    bumpHistoryVersion()
  }, [bumpHistoryVersion])

  const pushUndoSnapshot = useCallback(
    (nextNodes: MapEditorNode[], nextEdges: MapEditorEdge[]) => {
      const currentNodes = latestNodesRef.current
      const currentEdges = latestEdgesRef.current
      const currentSignature = createGraphSignature(currentNodes, currentEdges)
      const nextSignature = createGraphSignature(nextNodes, nextEdges)

      if (currentSignature === nextSignature) {
        return
      }

      const latestUndo =
        undoStackRef.current.length > 0
          ? undoStackRef.current[undoStackRef.current.length - 1]
          : null

      if (latestUndo?.signature !== currentSignature) {
        undoStackRef.current = [
          ...undoStackRef.current.slice(-(GRAPH_HISTORY_LIMIT - 1)),
          createHistorySnapshot(currentNodes, currentEdges),
        ]
      }

      redoStackRef.current = []
      bumpHistoryVersion()
    },
    [bumpHistoryVersion]
  )

  useEffect(() => {
    canEditRef.current = canEdit
  }, [canEdit])

  useEffect(() => {
    latestNodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    latestEdgesRef.current = edges
  }, [edges])

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId
  }, [selectedNodeId])

  useEffect(() => {
    selectedEdgeIdRef.current = selectedEdgeId
  }, [selectedEdgeId])

  const clearSelectionInvalidationNotice = useCallback(() => {
    if (selectionInvalidationTimerRef.current) {
      clearTimeout(selectionInvalidationTimerRef.current)
      selectionInvalidationTimerRef.current = null
    }

    setSelectionInvalidationNoticeSafe(null)
  }, [setSelectionInvalidationNoticeSafe])

  const publishSelectionInvalidationNotice = useCallback(
    (message: string | null) => {
      if (!message) {
        clearSelectionInvalidationNotice()
        return
      }

      if (selectionInvalidationTimerRef.current) {
        clearTimeout(selectionInvalidationTimerRef.current)
      }

      setSelectionInvalidationNoticeSafe(message)
      selectionInvalidationTimerRef.current = setTimeout(() => {
        selectionInvalidationTimerRef.current = null
        setSelectionInvalidationNoticeSafe(null)
      }, SELECTION_INVALIDATION_NOTICE_MS)
    },
    [clearSelectionInvalidationNotice, setSelectionInvalidationNoticeSafe]
  )

  useEffect(() => {
    return () => {
      isMountedRef.current = false

      if (selectionInvalidationTimerRef.current) {
        clearTimeout(selectionInvalidationTimerRef.current)
        selectionInvalidationTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setIsEditLocked(false)
  }, [mapId, roleCanEdit])

  useEffect(() => {
    editorSessionRef.current += 1
    isHydratedRef.current = false
    isPersistingRef.current = false
    shouldPersistAgainRef.current = false
    pendingRemoteGraphRef.current = null
    undoStackRef.current = []
    redoStackRef.current = []
    setHistoryVersion((currentVersion) => currentVersion + 1)

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    setNodes([])
    setEdges([])
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    selectedNodeIdRef.current = null
    selectedEdgeIdRef.current = null
    setSaveStatusSafe("idle")
    setSaveErrorSafe(null)
    setLastEditedSafe(null)
    setSyncStatusSafe("connecting")
    setSyncErrorSafe(null)
    setHasRemoteUpdateAvailableSafe(false)
    clearSelectionInvalidationNotice()
  }, [
    clearSelectionInvalidationNotice,
    mapId,
    setHasRemoteUpdateAvailableSafe,
    setLastEditedSafe,
    setSaveErrorSafe,
    setSaveStatusSafe,
    setSyncErrorSafe,
    setSyncStatusSafe,
  ])

  useEffect(() => {
    if (!graphQuery.data) {
      return
    }

    editorSessionRef.current += 1
    latestNodesRef.current = graphQuery.data.nodes
    latestEdgesRef.current = graphQuery.data.edges

    setNodes(graphQuery.data.nodes)
    setEdges(graphQuery.data.edges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    selectedNodeIdRef.current = null
    selectedEdgeIdRef.current = null
    setSaveStatusSafe(canEdit ? "saved" : "idle")
    setSaveErrorSafe(null)
    setLastEditedSafe(graphQuery.data.lastEdited)
    setHasRemoteUpdateAvailableSafe(false)
    clearSelectionInvalidationNotice()
    pendingRemoteGraphRef.current = null

    persistedSignatureRef.current = createGraphSignature(
      graphQuery.data.nodes,
      graphQuery.data.edges
    )
    isHydratedRef.current = true
    isPersistingRef.current = false
    shouldPersistAgainRef.current = false
    clearGraphHistory()

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [
    canEdit,
    clearGraphHistory,
    clearSelectionInvalidationNotice,
    graphQuery.data,
    setHasRemoteUpdateAvailableSafe,
    setLastEditedSafe,
    setSaveErrorSafe,
    setSaveStatusSafe,
  ])

  const hasUnsavedLocalChanges = useCallback(() => {
    if (!isHydratedRef.current) {
      return false
    }

    if (
      Boolean(saveTimerRef.current) ||
      isPersistingRef.current ||
      shouldPersistAgainRef.current
    ) {
      return true
    }

    const currentSignature = createGraphSignature(
      latestNodesRef.current,
      latestEdgesRef.current
    )

    return currentSignature !== persistedSignatureRef.current
  }, [])

  const normalizeRemoteSnapshot = useCallback(
    (row: RemoteMapRow): RemoteGraphSnapshot | null => {
      const rowId = typeof row.id === "string" ? row.id.trim() : ""
      if (!rowId || rowId !== mapId) {
        return null
      }

      const normalizedNodes = normalizeLoadedNodes(row.nodes)
      const normalizedEdges = filterEdgesByExistingNodes(
        normalizeLoadedEdges(row.edges),
        normalizedNodes
      )

      return {
        edges: normalizedEdges,
        lastEdited: toIsoStringOrNull(row.last_edited),
        nodes: normalizedNodes,
        signature: createGraphSignature(normalizedNodes, normalizedEdges),
      }
    },
    [mapId]
  )

  const applyRemoteSnapshot = useCallback(
    (snapshot: RemoteGraphSnapshot) => {
      const previousSelectedNodeId = selectedNodeIdRef.current
      const previousSelectedEdgeId = selectedEdgeIdRef.current
      const nextGraph = reconcileSelection(
        snapshot.nodes,
        snapshot.edges,
        previousSelectedNodeId,
        previousSelectedEdgeId
      )
      const selectionInvalidationMessage = toSelectionInvalidationMessage({
        nextSelectedEdgeId: nextGraph.selectedEdgeId,
        nextSelectedNodeId: nextGraph.selectedNodeId,
        previousSelectedEdgeId,
        previousSelectedNodeId,
      })

      latestNodesRef.current = nextGraph.nodes
      latestEdgesRef.current = nextGraph.edges
      persistedSignatureRef.current = snapshot.signature
      pendingRemoteGraphRef.current = null
      shouldPersistAgainRef.current = false
      isHydratedRef.current = true

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      setNodes(nextGraph.nodes)
      setEdges(nextGraph.edges)
      setSelectedNodeId(nextGraph.selectedNodeId)
      setSelectedEdgeId(nextGraph.selectedEdgeId)
      selectedNodeIdRef.current = nextGraph.selectedNodeId
      selectedEdgeIdRef.current = nextGraph.selectedEdgeId
      setSaveErrorSafe(null)
      setSaveStatusSafe(canEditRef.current ? "saved" : "idle")
      setLastEditedSafe(snapshot.lastEdited)
      setHasRemoteUpdateAvailableSafe(false)
      clearGraphHistory()
      publishSelectionInvalidationNotice(selectionInvalidationMessage)
    },
    [
      clearGraphHistory,
      publishSelectionInvalidationNotice,
      setHasRemoteUpdateAvailableSafe,
      setLastEditedSafe,
      setSaveErrorSafe,
      setSaveStatusSafe,
    ]
  )

  const reloadFromRemote = useCallback(() => {
    if (isPersistingRef.current) {
      return
    }

    const pendingRemoteGraph = pendingRemoteGraphRef.current
    if (!pendingRemoteGraph) {
      return
    }

    applyRemoteSnapshot(pendingRemoteGraph)
  }, [applyRemoteSnapshot])

  useEffect(() => {
    if (!graphQuery.data) {
      return
    }

    const channel = supabase
      .channel(`map-editor-graph-${mapId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", filter: `id=eq.${mapId}`, schema: "public", table: "maps" },
        (payload) => {
          const row = payload.new
          if (!row || typeof row !== "object") {
            return
          }

          const remoteSnapshot = normalizeRemoteSnapshot(row as RemoteMapRow)
          if (!remoteSnapshot) {
            return
          }

          const currentSignature = createGraphSignature(
            latestNodesRef.current,
            latestEdgesRef.current
          )

          if (remoteSnapshot.signature === currentSignature) {
            persistedSignatureRef.current = remoteSnapshot.signature
            setLastEditedSafe(remoteSnapshot.lastEdited)
            pendingRemoteGraphRef.current = null
            setHasRemoteUpdateAvailableSafe(false)
            if (!isPersistingRef.current && !hasUnsavedLocalChanges()) {
              setSaveStatusSafe(canEditRef.current ? "saved" : "idle")
            }
            return
          }

          if (remoteSnapshot.signature === persistedSignatureRef.current) {
            setLastEditedSafe(remoteSnapshot.lastEdited)
            return
          }

          if (hasUnsavedLocalChanges()) {
            pendingRemoteGraphRef.current = remoteSnapshot
            setLastEditedSafe(remoteSnapshot.lastEdited)
            setHasRemoteUpdateAvailableSafe(true)
            return
          }

          applyRemoteSnapshot(remoteSnapshot)
        }
      )

    setSyncStatusSafe("connecting")
    setSyncErrorSafe(null)

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setSyncStatusSafe("listening")
        setSyncErrorSafe(null)
        return
      }

      if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setSyncStatusSafe("error")
        setSyncErrorSafe(toSyncErrorMessage(status))
      }
    })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    applyRemoteSnapshot,
    graphQuery.data,
    hasUnsavedLocalChanges,
    mapId,
    normalizeRemoteSnapshot,
    setHasRemoteUpdateAvailableSafe,
    setLastEditedSafe,
    setSaveStatusSafe,
    setSyncErrorSafe,
    setSyncStatusSafe,
  ])

  const persistLatestGraph = useCallback(
    async (expectedSession = editorSessionRef.current) => {
      if (!canEditRef.current || !isHydratedRef.current) {
        return
      }

      if (expectedSession !== editorSessionRef.current) {
        return
      }

      const nextNodes = latestNodesRef.current
      const nextEdges = latestEdgesRef.current
      const nextSignature = createGraphSignature(nextNodes, nextEdges)

      if (nextSignature === persistedSignatureRef.current) {
        if (!isPersistingRef.current) {
          setSaveStatusSafe("saved")
          setSaveErrorSafe(null)
        }
        shouldPersistAgainRef.current = false
        return
      }

      if (isPersistingRef.current) {
        shouldPersistAgainRef.current = true
        return
      }

      isPersistingRef.current = true
      setSaveStatusSafe("saving")
      setSaveErrorSafe(null)

      let didFail = false
      let lockEditing = false
      const saveSession = editorSessionRef.current

      try {
        await saveMapEditorGraphById(mapId, nextNodes, nextEdges)

        if (saveSession !== editorSessionRef.current) {
          return
        }

        persistedSignatureRef.current = nextSignature
        pendingRemoteGraphRef.current = null
        setHasRemoteUpdateAvailableSafe(false)
        setLastEditedSafe(new Date().toISOString())

        const latestAfterSave = createGraphSignature(
          latestNodesRef.current,
          latestEdgesRef.current
        )

        if (latestAfterSave === nextSignature) {
          setSaveStatusSafe("saved")
          setSaveErrorSafe(null)
          shouldPersistAgainRef.current = false
        } else {
          setSaveStatusSafe("dirty")
          shouldPersistAgainRef.current = true
        }
      } catch (error) {
        if (saveSession !== editorSessionRef.current) {
          return
        }

        didFail = true
        setSaveStatusSafe("error")
        setSaveErrorSafe(toSaveErrorMessage(error))
        shouldPersistAgainRef.current = false

        if (isPermissionLockError(error)) {
          lockEditing = true
          setIsEditLocked(true)
          if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
          }
        }
      } finally {
        const hasSameSession = saveSession === editorSessionRef.current
        isPersistingRef.current = false

        if (
          hasSameSession &&
          shouldPersistAgainRef.current &&
          !didFail &&
          !lockEditing
        ) {
          shouldPersistAgainRef.current = false
          void persistLatestGraph(saveSession)
        }
      }
    },
    [
      mapId,
      setHasRemoteUpdateAvailableSafe,
      setLastEditedSafe,
      setSaveErrorSafe,
      setSaveStatusSafe,
    ]
  )

  const queuePersist = useCallback(
    (
      nextNodes: MapEditorNode[],
      nextEdges: MapEditorEdge[],
      options: { recordHistory?: boolean } = {}
    ) => {
      if (!canEditRef.current || !isHydratedRef.current) {
        return
      }

      if (options.recordHistory !== false) {
        pushUndoSnapshot(nextNodes, nextEdges)
      }

      latestNodesRef.current = nextNodes
      latestEdgesRef.current = nextEdges

      const nextSignature = createGraphSignature(nextNodes, nextEdges)

      if (nextSignature === persistedSignatureRef.current) {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }

        if (!isPersistingRef.current) {
          setSaveStatusSafe("saved")
          setSaveErrorSafe(null)
        }
        return
      }

      setSaveStatusSafe((currentStatus) =>
        currentStatus === "saving" ? currentStatus : "dirty"
      )
      setSaveErrorSafe(null)

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      const scheduleSession = editorSessionRef.current
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null
        void persistLatestGraph(scheduleSession)
      }, SAVE_DEBOUNCE_MS)
    },
    [persistLatestGraph, pushUndoSnapshot, setSaveErrorSafe, setSaveStatusSafe]
  )

  const retrySave = useCallback(() => {
    if (!canEdit || !isHydratedRef.current) {
      return
    }

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    shouldPersistAgainRef.current = false
    void persistLatestGraph(editorSessionRef.current)
  }, [canEdit, persistLatestGraph])

  const applyLocalHistorySnapshot = useCallback(
    (snapshot: GraphHistorySnapshot) => {
      const nextGraph = reconcileSelection(
        snapshot.nodes,
        snapshot.edges,
        selectedNodeIdRef.current,
        selectedEdgeIdRef.current
      )

      latestNodesRef.current = nextGraph.nodes
      latestEdgesRef.current = nextGraph.edges
      setNodes(nextGraph.nodes)
      setEdges(nextGraph.edges)
      setSelectedNodeId(nextGraph.selectedNodeId)
      setSelectedEdgeId(nextGraph.selectedEdgeId)
      selectedNodeIdRef.current = nextGraph.selectedNodeId
      selectedEdgeIdRef.current = nextGraph.selectedEdgeId
      queuePersist(nextGraph.nodes, nextGraph.edges, { recordHistory: false })
    },
    [queuePersist]
  )

  const undoGraphChange = useCallback(() => {
    if (!canEdit || undoStackRef.current.length === 0) {
      return
    }

    clearSelectionInvalidationNotice()

    const previousSnapshot = undoStackRef.current[undoStackRef.current.length - 1]
    const currentSnapshot = createHistorySnapshot(
      latestNodesRef.current,
      latestEdgesRef.current
    )

    undoStackRef.current = undoStackRef.current.slice(0, -1)
    redoStackRef.current = [
      ...redoStackRef.current.slice(-(GRAPH_HISTORY_LIMIT - 1)),
      currentSnapshot,
    ]

    applyLocalHistorySnapshot(previousSnapshot)
    bumpHistoryVersion()
  }, [
    applyLocalHistorySnapshot,
    bumpHistoryVersion,
    canEdit,
    clearSelectionInvalidationNotice,
  ])

  const redoGraphChange = useCallback(() => {
    if (!canEdit || redoStackRef.current.length === 0) {
      return
    }

    clearSelectionInvalidationNotice()

    const nextSnapshot = redoStackRef.current[redoStackRef.current.length - 1]
    const currentSnapshot = createHistorySnapshot(
      latestNodesRef.current,
      latestEdgesRef.current
    )

    redoStackRef.current = redoStackRef.current.slice(0, -1)
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(GRAPH_HISTORY_LIMIT - 1)),
      currentSnapshot,
    ]

    applyLocalHistorySnapshot(nextSnapshot)
    bumpHistoryVersion()
  }, [
    applyLocalHistorySnapshot,
    bumpHistoryVersion,
    canEdit,
    clearSelectionInvalidationNotice,
  ])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!canEditRef.current || !isHydratedRef.current) {
        return
      }

      const currentSignature = createGraphSignature(
        latestNodesRef.current,
        latestEdgesRef.current
      )
      const hasPendingChanges =
        currentSignature !== persistedSignatureRef.current ||
        Boolean(saveTimerRef.current) ||
        isPersistingRef.current

      if (!hasPendingChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }

      if (!canEditRef.current || !isHydratedRef.current || isPersistingRef.current) {
        return
      }

      const nextNodes = latestNodesRef.current
      const nextEdges = latestEdgesRef.current
      const nextSignature = createGraphSignature(nextNodes, nextEdges)

      if (nextSignature === persistedSignatureRef.current) {
        return
      }

      const cleanupSession = editorSessionRef.current

      // Best-effort flush for route transitions with pending debounced changes.
      void saveMapEditorGraphById(mapId, nextNodes, nextEdges)
        .then(() => {
          if (cleanupSession === editorSessionRef.current) {
            persistedSignatureRef.current = nextSignature
          }
        })
        .catch(() => undefined)
    }
  }, [mapId])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const appliedChanges = canEdit ? changes : filterReadOnlyNodeChanges(changes)

      if (appliedChanges.length === 0) {
        return
      }

      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(appliedChanges, currentNodes)

        if (canEdit && hasPersistableNodeChanges(appliedChanges)) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const appliedChanges = canEdit ? changes : filterReadOnlyEdgeChanges(changes)

      if (appliedChanges.length === 0) {
        return
      }

      setEdges((currentEdges) => {
        const nextEdges = applyEdgeChanges(appliedChanges, currentEdges)

        if (canEdit && hasPersistableEdgeChanges(appliedChanges)) {
          queuePersist(latestNodesRef.current, nextEdges)
        }

        return nextEdges
      })
    },
    [canEdit, queuePersist]
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) {
        return
      }

      setEdges((currentEdges) => {
        const nextEdges = addEdge(
          {
            ...connection,
            id:
              connection.source && connection.target
                ? `edge-${connection.source}-${connection.target}-${Date.now()}`
                : `edge-${Date.now()}`,
          },
          currentEdges
        )
        queuePersist(latestNodesRef.current, nextEdges)
        return nextEdges
      })
    },
    [canEdit, queuePersist]
  )

  const addNode = useCallback(
    (position?: XYPosition) => {
      if (!canEdit) {
        return
      }

      setNodes((currentNodes) => {
        const nextNodes = [...currentNodes, createNewNode(currentNodes, position)]
        queuePersist(nextNodes, latestEdgesRef.current)
        return nextNodes
      })
    },
    [canEdit, queuePersist]
  )

  const clearSelection = useCallback(() => {
    clearSelectionInvalidationNotice()
    setNodes((currentNodes) =>
      currentNodes.some((node) => node.selected)
        ? currentNodes.map((node) =>
            node.selected
              ? {
                  ...node,
                  selected: false,
                }
              : node
          )
        : currentNodes
    )
    setEdges((currentEdges) =>
      currentEdges.some((edge) => edge.selected)
        ? currentEdges.map((edge) =>
            edge.selected
              ? {
                  ...edge,
                  selected: false,
                }
              : edge
          )
        : currentEdges
    )
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    selectedNodeIdRef.current = null
    selectedEdgeIdRef.current = null
  }, [clearSelectionInvalidationNotice])

  const selectNode = useCallback(
    (nodeId: string) => {
      clearSelectionInvalidationNotice()
      const hasNode = latestNodesRef.current.some((node) => node.id === nodeId)
      if (!hasNode) {
        clearSelection()
        return
      }

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          const shouldSelect = node.id === nodeId
          if (Boolean(node.selected) === shouldSelect) {
            return node
          }

          return {
            ...node,
            selected: shouldSelect,
          }
        })
      )
      setEdges((currentEdges) =>
        currentEdges.some((edge) => edge.selected)
          ? currentEdges.map((edge) =>
              edge.selected
                ? {
                    ...edge,
                    selected: false,
                  }
                : edge
            )
          : currentEdges
      )
      setSelectedNodeId(nodeId)
      setSelectedEdgeId(null)
      selectedNodeIdRef.current = nodeId
      selectedEdgeIdRef.current = null
    },
    [clearSelection, clearSelectionInvalidationNotice]
  )

  const handleSelectionChange = useCallback(
    (selection: OnSelectionChangeParams) => {
      clearSelectionInvalidationNotice()
      const nextNodeId = selection.nodes[0]?.id ?? null
      if (nextNodeId) {
        setSelectedNodeId(nextNodeId)
        setSelectedEdgeId(null)
        selectedNodeIdRef.current = nextNodeId
        selectedEdgeIdRef.current = null
        return
      }

      setSelectedNodeId(null)
      const nextEdgeId = selection.edges[0]?.id ?? null
      setSelectedEdgeId(nextEdgeId)
      selectedNodeIdRef.current = null
      selectedEdgeIdRef.current = nextEdgeId
    },
    [clearSelectionInvalidationNotice]
  )

  useEffect(() => {
    if (selectedNodeId && !nodes.some((node) => node.id === selectedNodeId)) {
      setSelectedNodeId(null)
      selectedNodeIdRef.current = null
    }

    if (selectedEdgeId && !edges.some((edge) => edge.id === selectedEdgeId)) {
      setSelectedEdgeId(null)
      selectedEdgeIdRef.current = null
    }
  }, [edges, nodes, selectedEdgeId, selectedNodeId])

  const selectedNode = useMemo<SelectedNodeSummary | null>(() => {
    if (!selectedNodeId) {
      return null
    }

    const foundNode = nodes.find((node) => node.id === selectedNodeId)
    if (!foundNode) {
      return null
    }

    return {
      collapsed: foundNode.data?.collapsed === true,
      color: normalizeNodeColor(foundNode.data?.color),
      description:
        typeof foundNode.data?.description === "string"
          ? foundNode.data.description
          : "",
      incomingEdgeCount: edges.filter((edge) => edge.target === foundNode.id).length,
      id: foundNode.id,
      kind: normalizeNodeKind(foundNode.data?.kind),
      media: normalizeNodeMedia(foundNode.data?.media),
      outgoingEdgeCount: edges.filter((edge) => edge.source === foundNode.id).length,
      position: {
        x: Math.round(foundNode.position.x),
        y: Math.round(foundNode.position.y),
      },
      title: getNodeTitleFromValue(foundNode.data?.title, `Node ${foundNode.id}`),
    }
  }, [edges, nodes, selectedNodeId])

  const selectedEdge = useMemo<SelectedEdgeSummary | null>(() => {
    if (!selectedEdgeId) {
      return null
    }

    const foundEdge = edges.find((edge) => edge.id === selectedEdgeId)
    if (!foundEdge) {
      return null
    }

    return {
      id: foundEdge.id,
      label: typeof foundEdge.label === "string" ? foundEdge.label : "",
      link: getEdgeTextField(foundEdge.data?.link),
      note: getEdgeTextField(foundEdge.data?.note),
      sourceNodeId: foundEdge.source,
      targetNodeId: foundEdge.target,
    }
  }, [edges, selectedEdgeId])

  const updateNodeTitle = useCallback(
    (nodeId: string, nextTitle: string) => {
      if (!canEdit) {
        return
      }

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== nodeId) {
            return node
          }

          const currentTitle =
            typeof node.data?.title === "string" ? node.data.title : ""
          if (currentTitle === nextTitle) {
            return node
          }

          didUpdate = true
          return {
            ...node,
            data: {
              ...node.data,
              title: nextTitle,
            },
          }
        })

        if (didUpdate) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist]
  )

  const updateSelectedNodeTitle = useCallback(
    (nextTitle: string) => {
      if (!selectedNodeId) {
        return
      }

      updateNodeTitle(selectedNodeId, nextTitle)
    },
    [selectedNodeId, updateNodeTitle]
  )

  const updateSelectedNodeDescription = useCallback(
    (nextDescription: string) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          const currentDescription =
            typeof node.data?.description === "string"
              ? node.data.description
              : ""
          if (currentDescription === nextDescription) {
            return node
          }

          didUpdate = true
          return {
            ...node,
            data: {
              ...node.data,
              description: nextDescription,
            },
          }
        })

        if (didUpdate) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist, selectedNodeId]
  )

  const updateSelectedNodeAppearance = useCallback(
    (nextAppearance: {
      color?: MapEditorNodeColor
      kind?: MapEditorNodeKind
    }) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          const nextColor =
            nextAppearance.color === undefined
              ? normalizeNodeColor(node.data?.color)
              : normalizeNodeColor(nextAppearance.color)
          const nextKind =
            nextAppearance.kind === undefined
              ? normalizeNodeKind(node.data?.kind)
              : normalizeNodeKind(nextAppearance.kind)
          const currentColor = normalizeNodeColor(node.data?.color)
          const currentKind = normalizeNodeKind(node.data?.kind)

          if (currentColor === nextColor && currentKind === nextKind) {
            return node
          }

          didUpdate = true
          return {
            ...node,
            data: {
              ...node.data,
              color: nextColor,
              kind: nextKind,
            },
          }
        })

        if (didUpdate) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist, selectedNodeId]
  )

  const updateSelectedNodeMedia = useCallback(
    (nextMedia: MapEditorNodeMedia | null) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      const normalizedMedia = normalizeNodeMedia(nextMedia)

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          const currentMedia = normalizeNodeMedia(node.data?.media)
          if (JSON.stringify(currentMedia) === JSON.stringify(normalizedMedia)) {
            return node
          }

          didUpdate = true
          return {
            ...node,
            data: {
              ...node.data,
              media: normalizedMedia,
            },
          }
        })

        if (didUpdate) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist, selectedNodeId]
  )

  const updateSelectedNodeCollapsed = useCallback(
    (nextCollapsed: boolean) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          const currentCollapsed = node.data?.collapsed === true
          if (currentCollapsed === nextCollapsed) {
            return node
          }

          didUpdate = true
          return {
            ...node,
            data: {
              ...node.data,
              collapsed: nextCollapsed,
            },
          }
        })

        if (didUpdate) {
          queuePersist(nextNodes, latestEdgesRef.current)
        }

        return nextNodes
      })
    },
    [canEdit, queuePersist, selectedNodeId]
  )

  const updateSelectedEdgeLabel = useCallback(
    (nextLabel: string) => {
      if (!canEdit || !selectedEdgeId) {
        return
      }

      setEdges((currentEdges) => {
        let didUpdate = false

        const nextEdges = currentEdges.map((edge) => {
          if (edge.id !== selectedEdgeId) {
            return edge
          }

          const currentLabel = typeof edge.label === "string" ? edge.label : ""
          if (currentLabel === nextLabel) {
            return edge
          }

          didUpdate = true
          return {
            ...edge,
            label: nextLabel,
          }
        })

        if (didUpdate) {
          queuePersist(latestNodesRef.current, nextEdges)
        }

        return nextEdges
      })
    },
    [canEdit, queuePersist, selectedEdgeId]
  )

  const updateSelectedEdgeDetails = useCallback(
    (nextDetails: { link?: string; note?: string }) => {
      if (!canEdit || !selectedEdgeId) {
        return
      }

      setEdges((currentEdges) => {
        let didUpdate = false

        const nextEdges = currentEdges.map((edge) => {
          if (edge.id !== selectedEdgeId) {
            return edge
          }

          const currentNote = getEdgeTextField(edge.data?.note)
          const currentLink = getEdgeTextField(edge.data?.link)
          const nextNote =
            nextDetails.note === undefined ? currentNote : nextDetails.note
          const nextLink =
            nextDetails.link === undefined ? currentLink : nextDetails.link

          if (currentNote === nextNote && currentLink === nextLink) {
            return edge
          }

          didUpdate = true
          return {
            ...edge,
            data: {
              ...edge.data,
              link: nextLink,
              note: nextNote,
            },
          }
        })

        if (didUpdate) {
          queuePersist(latestNodesRef.current, nextEdges)
        }

        return nextEdges
      })
    },
    [canEdit, queuePersist, selectedEdgeId]
  )

  const deleteSelection = useCallback(() => {
    if (!canEdit) {
      return
    }

    clearSelectionInvalidationNotice()

    const nodeIdsToDelete = new Set(
      latestNodesRef.current.filter((node) => node.selected).map((node) => node.id)
    )
    const edgeIdsToDelete = new Set(
      latestEdgesRef.current.filter((edge) => edge.selected).map((edge) => edge.id)
    )

    if (selectedNodeId) {
      nodeIdsToDelete.add(selectedNodeId)
    }

    if (selectedEdgeId) {
      edgeIdsToDelete.add(selectedEdgeId)
    }

    if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
      return
    }

    const nextNodes = latestNodesRef.current.filter(
      (node) => !nodeIdsToDelete.has(node.id)
    )
    const nextEdges = latestEdgesRef.current.filter((edge) => {
      if (edge.id && edgeIdsToDelete.has(edge.id)) {
        return false
      }

      return !nodeIdsToDelete.has(edge.source) && !nodeIdsToDelete.has(edge.target)
    })

    setNodes(nextNodes)
    setEdges(nextEdges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    selectedNodeIdRef.current = null
    selectedEdgeIdRef.current = null
    queuePersist(nextNodes, nextEdges)
  }, [
    canEdit,
    clearSelectionInvalidationNotice,
    queuePersist,
    selectedEdgeId,
    selectedNodeId,
  ])

  const organizeMap = useCallback(() => {
    if (!canEdit || latestNodesRef.current.length === 0) {
      return
    }

    const currentNodes = latestNodesRef.current
    const currentEdges = latestEdgesRef.current
    const nodeIds = new Set(currentNodes.map((node) => node.id))
    const outgoingEdgesByNode = new Map<string, MapEditorEdge[]>()
    const incomingCountByNode = new Map<string, number>()

    for (const node of currentNodes) {
      outgoingEdgesByNode.set(node.id, [])
      incomingCountByNode.set(node.id, 0)
    }

    for (const edge of currentEdges) {
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
        continue
      }

      outgoingEdgesByNode.get(edge.source)?.push(edge)
      incomingCountByNode.set(
        edge.target,
        (incomingCountByNode.get(edge.target) ?? 0) + 1
      )
    }

    const roots = currentNodes
      .filter((node) => (incomingCountByNode.get(node.id) ?? 0) === 0)
      .sort((firstNode, secondNode) =>
        firstNode.position.y === secondNode.position.y
          ? firstNode.position.x - secondNode.position.x
          : firstNode.position.y - secondNode.position.y
      )

    const queue: MapEditorNode[] =
      roots.length > 0 ? [...roots] : currentNodes[0] ? [currentNodes[0]] : []
    const levelByNode = new Map<string, number>()

    for (const root of queue) {
      levelByNode.set(root.id, 0)
    }

    for (let index = 0; index < queue.length; index += 1) {
      const currentNode = queue[index]
      const currentLevel = levelByNode.get(currentNode.id) ?? 0
      const outgoingEdges = outgoingEdgesByNode.get(currentNode.id) ?? []

      for (const edge of outgoingEdges) {
        if (levelByNode.has(edge.target)) {
          continue
        }

        const targetNode = currentNodes.find((node) => node.id === edge.target)
        if (!targetNode) {
          continue
        }

        levelByNode.set(targetNode.id, currentLevel + 1)
        queue.push(targetNode)
      }
    }

    const maxAssignedLevel =
      levelByNode.size > 0 ? Math.max(...Array.from(levelByNode.values())) : 0
    for (const node of currentNodes) {
      if (!levelByNode.has(node.id)) {
        levelByNode.set(node.id, maxAssignedLevel + 1)
      }
    }

    const nodesByLevel = new Map<number, MapEditorNode[]>()
    for (const node of currentNodes) {
      const level = levelByNode.get(node.id) ?? 0
      const levelNodes = nodesByLevel.get(level) ?? []
      levelNodes.push(node)
      nodesByLevel.set(level, levelNodes)
    }

    const positionByNode = new Map<string, XYPosition>()
    const orderedLevels = Array.from(nodesByLevel.keys()).sort(
      (firstLevel, secondLevel) => firstLevel - secondLevel
    )
    let columnStartX = ORGANIZE_LAYOUT_ORIGIN.x

    for (const level of orderedLevels) {
      const levelNodes = nodesByLevel.get(level) ?? []
      const sortedLevelNodes = [...levelNodes].sort((firstNode, secondNode) =>
        firstNode.position.y === secondNode.position.y
          ? firstNode.position.x - secondNode.position.x
          : firstNode.position.y - secondNode.position.y
      )

      const nodeSizes = sortedLevelNodes.map((node) => getNodeLayoutSize(node))
      const columnWidth = nodeSizes.reduce(
        (largestWidth, size) => Math.max(largestWidth, size.width),
        0
      )
      const totalColumnHeight =
        nodeSizes.reduce((heightTotal, size) => heightTotal + size.height, 0) +
        Math.max(0, sortedLevelNodes.length - 1) * ORGANIZE_ROW_GAP
      let rowStartY = ORGANIZE_LAYOUT_ORIGIN.y - totalColumnHeight / 2

      sortedLevelNodes.forEach((node, index) => {
        const nodeSize = nodeSizes[index]
        positionByNode.set(node.id, {
          x: Math.round(columnStartX + (columnWidth - nodeSize.width) / 2),
          y: Math.round(rowStartY),
        })
        rowStartY += nodeSize.height + ORGANIZE_ROW_GAP
      })

      columnStartX += columnWidth + ORGANIZE_COLUMN_GAP
    }

    const nextNodes = currentNodes.map((node) => {
      const nextPosition = positionByNode.get(node.id)
      if (!nextPosition) {
        return node
      }

      return {
        ...node,
        position: nextPosition,
      }
    })

    setNodes(nextNodes)
    queuePersist(nextNodes, currentEdges)
  }, [canEdit, queuePersist])

  const insertBranchStarter = useCallback(
    (starter: BuiltInBranchStarter) => {
      if (!canEdit || !selectedNodeIdRef.current) {
        return null
      }

      const anchorNodeId = selectedNodeIdRef.current
      const insertion = instantiateBranchStarterGraph(starter, {
        anchorNodeId,
        currentEdges: latestEdgesRef.current,
        currentNodes: latestNodesRef.current,
      })

      if (!insertion) {
        return null
      }

      const nextNodes = [
        ...latestNodesRef.current.map((node) => {
          const shouldExpand = node.id === anchorNodeId && node.data?.collapsed === true
          const nextSelected = node.id === insertion.rootNodeId

          if (!shouldExpand && Boolean(node.selected) === nextSelected) {
            return node
          }

          return {
            ...node,
            data: shouldExpand
              ? {
                  ...node.data,
                  collapsed: false,
                }
              : node.data,
            selected: nextSelected,
          }
        }),
        ...insertion.nodes.map((node) => ({
          ...node,
          selected: node.id === insertion.rootNodeId,
        })),
      ]
      const nextEdges = [
        ...latestEdgesRef.current.map((edge) =>
          edge.selected
            ? {
                ...edge,
                selected: false,
              }
            : edge
        ),
        ...insertion.edges,
      ]

      setNodes(nextNodes)
      setEdges(nextEdges)
      setSelectedNodeId(insertion.rootNodeId)
      setSelectedEdgeId(null)
      selectedNodeIdRef.current = insertion.rootNodeId
      selectedEdgeIdRef.current = null
      clearSelectionInvalidationNotice()
      queuePersist(nextNodes, nextEdges)

      return insertion.rootNodeId
    },
    [canEdit, clearSelectionInvalidationNotice, queuePersist]
  )

  const retryLoad = useCallback(() => {
    void graphQuery.refetch()
  }, [graphQuery])

  const hasSelection = Boolean(selectedNode || selectedEdge)
  const nodeCount = nodes.length
  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0

  return {
    addNode,
    canEdit,
    canRedo,
    canUndo,
    clearSelection,
    deleteSelection,
    edges,
    handleConnect,
    handleEdgesChange,
    handleNodesChange,
    handleSelectionChange,
    hasRemoteUpdateAvailable,
    hasSelection,
    isLoading: graphQuery.isLoading,
    insertBranchStarter,
    lastEdited,
    loadError: graphQuery.error instanceof Error ? graphQuery.error.message : null,
    nodes,
    nodeCount,
    organizeMap,
    redoGraphChange,
    reloadFromRemote,
    retryLoad,
    retrySave,
    saveError,
    saveStatus,
    selectionInvalidationNotice,
    selectNode,
    selectedEdge,
    selectedNode,
    syncError,
    syncStatus,
    undoGraphChange,
    updateSelectedEdgeDetails,
    updateNodeTitle,
    updateSelectedEdgeLabel,
    updateSelectedNodeAppearance,
    updateSelectedNodeCollapsed,
    updateSelectedNodeDescription,
    updateSelectedNodeMedia,
    updateSelectedNodeTitle,
  }
}
