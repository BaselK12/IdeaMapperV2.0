import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  saveMapEditorGraphById,
} from "@/features/map-editor/api/map-editor-api"
import type {
  MapEditorEdge,
  MapEditorNode,
  MapEditorSaveStatus,
  SelectedNodeSummary,
} from "@/features/map-editor/types/map-editor-types"
import {
  createGraphSignature,
  createNewNode,
  getNodeTitleFromValue,
  toRoleCanEdit,
} from "@/features/map-editor/utils/map-editor-graph"

type UseMapEditorParams = {
  mapId: string
  role: string
}

export function useMapEditor({ mapId, role }: UseMapEditorParams) {
  const canEdit = useMemo(() => toRoleCanEdit(role), [role])
  const [nodes, setNodes] = useState<MapEditorNode[]>([])
  const [edges, setEdges] = useState<MapEditorEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<MapEditorSaveStatus>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestNodesRef = useRef<MapEditorNode[]>([])
  const latestEdgesRef = useRef<MapEditorEdge[]>([])
  const persistedSignatureRef = useRef("")
  const isHydratedRef = useRef(false)

  const graphQuery = useQuery({
    enabled: Boolean(mapId),
    queryFn: async () => fetchMapEditorGraphById(mapId),
    queryKey: ["map-editor", "graph", mapId],
    refetchOnWindowFocus: false,
    retry: false,
  })

  useEffect(() => {
    latestNodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    latestEdgesRef.current = edges
  }, [edges])

  useEffect(() => {
    if (!graphQuery.data) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes(graphQuery.data.nodes)
    setEdges(graphQuery.data.edges)
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setSaveStatus("idle")
    setSaveError(null)
    persistedSignatureRef.current = createGraphSignature(
      graphQuery.data.nodes,
      graphQuery.data.edges
    )
    isHydratedRef.current = true
  }, [graphQuery.data])

  const persistGraph = useCallback(
    async (nextNodes: MapEditorNode[], nextEdges: MapEditorEdge[]) => {
      if (!canEdit || !isHydratedRef.current) {
        return
      }

      const nextSignature = createGraphSignature(nextNodes, nextEdges)
      if (nextSignature === persistedSignatureRef.current) {
        return
      }

      setSaveStatus("saving")
      setSaveError(null)

      try {
        await saveMapEditorGraphById(mapId, nextNodes, nextEdges)
        persistedSignatureRef.current = nextSignature
        setSaveStatus("saved")
      } catch (error) {
        setSaveStatus("error")
        setSaveError(error instanceof Error ? error.message : "Could not save map changes.")
      }
    },
    [canEdit, mapId]
  )

  const queuePersist = useCallback(
    (nextNodes: MapEditorNode[], nextEdges: MapEditorEdge[]) => {
      if (!canEdit || !isHydratedRef.current) {
        return
      }

      const nextSignature = createGraphSignature(nextNodes, nextEdges)
      if (nextSignature === persistedSignatureRef.current) {
        return
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }

      saveTimerRef.current = setTimeout(() => {
        void persistGraph(nextNodes, nextEdges)
      }, 700)
    },
    [canEdit, persistGraph]
  )

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((currentNodes) => {
        const nextNodes = applyNodeChanges(changes, currentNodes)
        queuePersist(nextNodes, latestEdgesRef.current)
        return nextNodes
      })
    },
    [queuePersist]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((currentEdges) => {
        const nextEdges = applyEdgeChanges(changes, currentEdges)
        queuePersist(latestNodesRef.current, nextEdges)
        return nextEdges
      })
    },
    [queuePersist]
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
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  const handleSelectionChange = useCallback((selection: OnSelectionChangeParams) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null)
    setSelectedEdgeId(selection.edges[0]?.id ?? null)
  }, [])

  const selectedNode = useMemo<SelectedNodeSummary | null>(() => {
    if (!selectedNodeId) {
      return null
    }

    const foundNode = nodes.find((node) => node.id === selectedNodeId)
    if (!foundNode) {
      return null
    }

    return {
      id: foundNode.id,
      title: getNodeTitleFromValue(foundNode.data?.title, `Node ${foundNode.id}`),
    }
  }, [nodes, selectedNodeId])

  const updateSelectedNodeTitle = useCallback(
    (nextTitle: string) => {
      if (!canEdit || !selectedNodeId) {
        return
      }

      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((node) => {
          if (node.id !== selectedNodeId) {
            return node
          }

          return {
            ...node,
            data: {
              ...node.data,
              title: nextTitle,
            },
          }
        })
        queuePersist(nextNodes, latestEdgesRef.current)
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

    if (nodeIdsToDelete.size === 0 && edgeIdsToDelete.size === 0) {
      return
    }

    const nextNodes = latestNodesRef.current.filter((node) => !nodeIdsToDelete.has(node.id))
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
    queuePersist(nextNodes, nextEdges)
  }, [canEdit, queuePersist])

  const retryLoad = useCallback(() => {
    void graphQuery.refetch()
  }, [graphQuery])

  const hasSelection = Boolean(selectedNodeId || selectedEdgeId)
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
    hasSelection,
    isLoading: graphQuery.isLoading,
    loadError: graphQuery.error instanceof Error ? graphQuery.error.message : null,
    nodes,
    nodeCount,
    retryLoad,
    saveError,
    saveStatus,
    selectedEdgeId,
    selectedNode,
    updateSelectedNodeTitle,
  }
}
