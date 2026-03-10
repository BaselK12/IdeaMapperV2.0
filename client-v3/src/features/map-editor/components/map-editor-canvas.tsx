import { useCallback, useEffect, useMemo, useRef } from "react"
import { Sparkles } from "lucide-react"
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type XYPosition,
} from "reactflow"
import "reactflow/dist/style.css"

import { Button } from "@/components/ui/button"
import { MapEditorNode } from "@/features/map-editor/components/map-editor-node"
import type { MapEditorEdge, MapEditorNode as MapEditorFlowNode } from "@/features/map-editor/types/map-editor-types"

const nodeTypes = {
  mapNode: MapEditorNode,
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  if (target.isContentEditable) {
    return true
  }

  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox']"
    )
  )
}

export type MapEditorCanvasFocusRequest = {
  nodeId: string
  requestKey: number
}

type MapEditorCanvasProps = {
  canEdit: boolean
  edges: MapEditorEdge[]
  focusRequest: MapEditorCanvasFocusRequest | null
  hasSelection: boolean
  isLoading: boolean
  loadError: string | null
  nodes: MapEditorFlowNode[]
  onAddNode: (position?: XYPosition) => void
  onClearSelection: () => void
  onConnect: (connection: Connection) => void
  onDeleteSelection: () => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onNodesChange: (changes: NodeChange[]) => void
  onRetryLoad: () => void
  onSelectionChange: (selection: OnSelectionChangeParams) => void
}

export function MapEditorCanvas({
  canEdit,
  edges,
  focusRequest,
  hasSelection,
  isLoading,
  loadError,
  nodes,
  onAddNode,
  onClearSelection,
  onConnect,
  onDeleteSelection,
  onEdgesChange,
  onNodesChange,
  onRetryLoad,
  onSelectionChange,
}: MapEditorCanvasProps) {
  const flowContainerRef = useRef<HTMLDivElement | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)
  const hasInitialFitRef = useRef(false)

  const handleFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance
  }, [])

  const handleAddNode = useCallback(() => {
    if (!canEdit) {
      return
    }

    if (!reactFlowRef.current || !flowContainerRef.current) {
      onAddNode()
      return
    }

    const containerBounds = flowContainerRef.current.getBoundingClientRect()
    const viewportCenter = reactFlowRef.current.screenToFlowPosition({
      x: containerBounds.left + containerBounds.width / 2,
      y: containerBounds.top + containerBounds.height / 2,
    })

    onAddNode({
      x: viewportCenter.x - 90,
      y: viewportCenter.y - 40,
    })
  }, [canEdit, onAddNode])

  useEffect(() => {
    if (isLoading) {
      hasInitialFitRef.current = false
    }
  }, [isLoading])

  useEffect(() => {
    if (isLoading || loadError || !reactFlowRef.current || hasInitialFitRef.current) {
      return
    }

    hasInitialFitRef.current = true
    if (nodes.length === 0) {
      return
    }

    requestAnimationFrame(() => {
      reactFlowRef.current?.fitView({
        duration: 320,
        padding: 0.2,
      })
    })
  }, [isLoading, loadError, nodes.length])

  useEffect(() => {
    if (!focusRequest || !reactFlowRef.current) {
      return
    }

    const focusNode = nodes.find((node) => node.id === focusRequest.nodeId)
    if (!focusNode) {
      return
    }

    const nodeWidth = typeof focusNode.width === "number" ? focusNode.width : 180
    const nodeHeight = typeof focusNode.height === "number" ? focusNode.height : 84

    reactFlowRef.current.setCenter(
      focusNode.position.x + nodeWidth / 2,
      focusNode.position.y + nodeHeight / 2,
      {
        duration: 300,
        zoom: Math.max(reactFlowRef.current.getZoom(), 0.85),
      }
    )
  }, [focusRequest, nodes])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!canEdit || !hasSelection) {
        return
      }

      if (event.defaultPrevented) {
        return
      }

      if (event.key !== "Backspace" && event.key !== "Delete") {
        return
      }

      if (isEditableEventTarget(event.target)) {
        return
      }

      event.preventDefault()
      onDeleteSelection()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [canEdit, hasSelection, onDeleteSelection])

  const decoratedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: Boolean(edge.selected),
        style: {
          ...edge.style,
          stroke: edge.selected
            ? "hsl(var(--primary) / 0.92)"
            : "hsl(var(--foreground) / 0.34)",
          strokeWidth: edge.selected ? 2.4 : 1.8,
        },
      })),
    [edges]
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-border/70 bg-card/65">
        <p className="text-sm text-muted-foreground">Loading map graph...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border border-destructive/40 bg-destructive/5 px-5 text-center">
        <p className="text-sm font-medium text-destructive">Failed to load nodes and edges</p>
        <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        <Button className="mt-4" onClick={onRetryLoad} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-border/70 bg-background/90">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.45)_1px,transparent_0)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/60" />

      <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
        {canEdit ? (
          <Button onClick={handleAddNode} size="sm" variant="secondary">
            Add node
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            disabled={!hasSelection}
            onClick={onDeleteSelection}
            size="sm"
            variant="outline"
          >
            Delete selection
          </Button>
        ) : null}
      </div>

      <div className="h-full w-full" ref={flowContainerRef}>
        <ReactFlow
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            style: {
              stroke: "hsl(var(--foreground) / 0.34)",
              strokeWidth: 1.8,
            },
            type: "smoothstep",
          }}
          deleteKeyCode={null}
          edges={decoratedEdges}
          edgesFocusable
          edgesUpdatable={canEdit}
          elementsSelectable
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={canEdit}
          nodesDraggable={canEdit}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onInit={handleFlowInit}
          onNodesChange={onNodesChange}
          onPaneClick={onClearSelection}
          onSelectionChange={onSelectionChange}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag
        >
          <MiniMap
            className="!bg-card/90"
            maskColor="hsl(var(--background) / 0.45)"
            nodeBorderRadius={8}
            nodeColor="hsl(var(--primary) / 0.35)"
            pannable
            zoomable
          />
          <Controls className="!border-border/70 !bg-card/95 !shadow-sm" />
          <Background color="hsl(var(--border) / 0.5)" gap={22} size={1} />
        </ReactFlow>
      </div>

      {nodes.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-border/80 bg-card/95 p-5 text-center shadow-sm">
            <span className="inline-flex size-9 items-center justify-center rounded-full border border-primary/25 bg-primary-soft text-primary">
              <Sparkles className="size-4" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Empty canvas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with one anchor idea and grow the map by connecting related nodes.
            </p>
            {canEdit ? (
              <Button className="mt-4" onClick={handleAddNode} size="sm">
                Add first node
              </Button>
            ) : (
              <p className="mt-4 text-xs text-muted-foreground">
                This map is view-only for your account.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
