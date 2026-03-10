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
import { supabase } from "@/lib/supabase"
import type {
  MapEditorEdge,
  MapEditorNode,
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
  toRoleCanEdit,
} from "@/features/map-editor/utils/map-editor-graph"

type UseMapEditorParams = {
  mapId: string
  role: string
}

const SAVE_DEBOUNCE_MS = 700

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
    return "Realtime sync connection failed."
  }

  if (status === "TIMED_OUT") {
    return "Realtime sync timed out."
  }

  if (status === "CLOSED") {
    return "Realtime sync disconnected."
  }

  return "Realtime sync is unavailable."
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

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestNodesRef = useRef<MapEditorNode[]>([])
  const latestEdgesRef = useRef<MapEditorEdge[]>([])
  const selectedNodeIdRef = useRef<string | null>(null)
  const selectedEdgeIdRef = useRef<string | null>(null)
  const persistedSignatureRef = useRef("")
  const pendingRemoteGraphRef = useRef<RemoteGraphSnapshot | null>(null)
  const isHydratedRef = useRef(false)
  const isPersistingRef = useRef(false)
  const shouldPersistAgainRef = useRef(false)
  const editorSessionRef = useRef(0)
  const canEditRef = useRef(canEdit)
  const isMountedRef = useRef(true)

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

  useEffect(() => {
    return () => {
      isMountedRef.current = false
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
  }, [
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
    pendingRemoteGraphRef.current = null

    persistedSignatureRef.current = createGraphSignature(
      graphQuery.data.nodes,
      graphQuery.data.edges
    )
    isHydratedRef.current = true
    isPersistingRef.current = false
    shouldPersistAgainRef.current = false

    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
  }, [
    canEdit,
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
      const nextGraph = reconcileSelection(
        snapshot.nodes,
        snapshot.edges,
        selectedNodeIdRef.current,
        selectedEdgeIdRef.current
      )

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
    },
    [
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
    (nextNodes: MapEditorNode[], nextEdges: MapEditorEdge[]) => {
      if (!canEditRef.current || !isHydratedRef.current) {
        return
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
    [persistLatestGraph, setSaveErrorSafe, setSaveStatusSafe]
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
  }, [])

  const selectNode = useCallback(
    (nodeId: string) => {
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
    [clearSelection]
  )

  const handleSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
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
  }, [])

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
      incomingEdgeCount: edges.filter((edge) => edge.target === foundNode.id).length,
      id: foundNode.id,
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

    const nextLabel =
      typeof foundEdge.label === "string" && foundEdge.label.trim().length > 0
        ? foundEdge.label
        : null

    return {
      id: foundEdge.id,
      label: nextLabel,
      sourceNodeId: foundEdge.source,
      targetNodeId: foundEdge.target,
    }
  }, [edges, selectedEdgeId])

  const updateSelectedNodeTitle = useCallback(
    (nextTitle: string) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      setNodes((currentNodes) => {
        let didUpdate = false

        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
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
    [canEdit, queuePersist, selectedNodeId]
  )

  const deleteSelection = useCallback(() => {
    if (!canEdit) {
      return
    }

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
  }, [canEdit, queuePersist, selectedEdgeId, selectedNodeId])

  const retryLoad = useCallback(() => {
    void graphQuery.refetch()
  }, [graphQuery])

  const hasSelection = Boolean(selectedNode || selectedEdge)
  const nodeCount = nodes.length

  return {
    addNode,
    canEdit,
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
    lastEdited,
    loadError: graphQuery.error instanceof Error ? graphQuery.error.message : null,
    nodes,
    nodeCount,
    reloadFromRemote,
    retryLoad,
    retrySave,
    saveError,
    saveStatus,
    selectNode,
    selectedEdge,
    selectedNode,
    syncError,
    syncStatus,
    updateSelectedNodeTitle,
  }
}
