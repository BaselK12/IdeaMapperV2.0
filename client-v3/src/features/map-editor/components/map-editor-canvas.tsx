import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  HelpCircle,
  LocateFixed,
  Network,
  Plus,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react"
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  MarkerType,
  MiniMap,
  getSmoothStepPath,
  type Connection,
  type EdgeChange,
  type EdgeProps,
  type NodeChange,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type Viewport,
  type XYPosition,
} from "reactflow"
import "reactflow/dist/style.css"

import { Button } from "@/components/ui/button"
import { MapEditorNode } from "@/features/map-editor/components/map-editor-node"
import type { MapEditorEdge, MapEditorNode as MapEditorFlowNode } from "@/features/map-editor/types/map-editor-types"

function MapEditorEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  label,
  selected,
  markerEnd,
  style,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  })

  const note = typeof data?.note === "string" ? data.note.trim() : ""
  const link = typeof data?.link === "string" ? data.link.trim() : ""
  const displayLabel =
    typeof label === "string" && label.trim()
      ? label.trim()
      : note || link
        ? "Details"
        : null

  return (
    <>
      <BaseEdge id={id} markerEnd={markerEnd} path={edgePath} style={style} />
      {displayLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              left: labelX,
              pointerEvents: "all",
              position: "absolute",
              top: labelY,
              transform: "translate(-50%, -50%)",
            }}
          >
            <span
              className={
                selected
                  ? "inline-flex items-center rounded-md border border-primary/40 bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary shadow-sm"
                  : "inline-flex items-center rounded-md border border-border/80 bg-card px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-sm"
              }
            >
              {displayLabel}
            </span>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const nodeTypes = {
  mapNode: MapEditorNode,
}

const edgeTypes = {
  mapEdge: MapEditorEdgeComponent,
}

const reactFlowChromeStyles = `
  .map-editor-flow .react-flow__selection {
    border: 1px solid hsl(var(--primary) / 0.55);
    background: hsl(var(--primary) / 0.12);
  }

  .map-editor-flow .react-flow__controls-button {
    display: flex;
    height: 2.25rem;
    width: 2.25rem;
    align-items: center;
    justify-content: center;
    border: 0;
    border-bottom: 1px solid hsl(var(--border) / 0.78);
    background: hsl(var(--card) / 0.95);
    color: hsl(var(--foreground));
    transition: background-color 140ms ease, color 140ms ease;
  }

  .map-editor-flow .react-flow__controls-button:last-child {
    border-bottom: 0;
  }

  .map-editor-flow .react-flow__controls-button:hover {
    background: hsl(var(--muted) / 0.88);
  }

  .map-editor-flow .react-flow__controls-button:disabled {
    color: hsl(var(--muted-foreground) / 0.72);
  }

  .map-editor-flow .react-flow__controls-button svg {
    fill: currentColor;
    stroke: currentColor;
  }

  .map-editor-flow .react-flow__minimap {
    height: 7rem;
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
    width: 10rem;
  }

  .map-editor-flow .react-flow__controls {
    box-shadow: 0 10px 24px rgba(15, 23, 42, 0.16);
  }

  .dark .map-editor-flow .react-flow__minimap,
  .dark .map-editor-flow .react-flow__controls {
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  }

  @media (max-width: 640px) {
    .map-editor-flow .react-flow__minimap {
      display: none;
    }

    .map-editor-flow .react-flow__controls {
      display: none;
    }
  }
`

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

export type MapEditorRemoteCursor = {
  color: string
  userId: string
  username: string
  x: number
  y: number
}

export type MapEditorRemoteNodeDrag = {
  color: string
  nodeId: string
  userId: string
  username: string
  x: number
  y: number
}

type MapEditorCanvasProps = {
  canRedo: boolean
  canEdit: boolean
  canUndo: boolean
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
  onOrganizeMap: () => void
  onRedo: () => void
  onCursorPositionChange?: (position: XYPosition) => void
  onNodeDragEnd?: (nodeId: string) => void
  onNodeDragPositionChange?: (nodeId: string, position: XYPosition) => void
  onRetryLoad: () => void
  onSelectionChange: (selection: OnSelectionChangeParams) => void
  onUndo: () => void
  onUpdateNodeTitle: (nodeId: string, title: string) => void
  remoteCursors?: MapEditorRemoteCursor[]
  remoteNodeDrags?: MapEditorRemoteNodeDrag[]
}

type RenderedRemoteNodeDragBadge = {
  color: string
  left: number
  nodeId: string
  top: number
  userId: string
  username: string
}

function compactCursorName(username: string) {
  const normalizedUsername = username.trim()
  if (!normalizedUsername) {
    return "Member"
  }

  if (normalizedUsername.length <= 20) {
    return normalizedUsername
  }

  return `${normalizedUsername.slice(0, 19)}...`
}

function cursorInitials(username: string) {
  const parts = username
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)

  if (parts.length === 0) {
    return "M"
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("")
}

function remoteNodeBadgeCopy(username: string) {
  const name = compactCursorName(username)
  return `${name} moving`
}

export function MapEditorCanvas({
  canRedo,
  canEdit,
  canUndo,
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
  onOrganizeMap,
  onRedo,
  onCursorPositionChange,
  onNodeDragEnd,
  onNodeDragPositionChange,
  onRetryLoad,
  onSelectionChange,
  onUndo,
  onUpdateNodeTitle,
  remoteCursors = [],
  remoteNodeDrags = [],
}: MapEditorCanvasProps) {
  const flowContainerRef = useRef<HTMLDivElement | null>(null)
  const reactFlowRef = useRef<ReactFlowInstance | null>(null)
  const hasInitialFitRef = useRef(false)
  const [flowReadyVersion, setFlowReadyVersion] = useState(0)
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  })
  const [inlineEditingNodeId, setInlineEditingNodeId] = useState<string | null>(
    null
  )
  const [showHelp, setShowHelp] = useState(false)

  const handleFlowInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance
    setFlowReadyVersion((currentVersion) => currentVersion + 1)
    setViewport(instance.getViewport())
  }, [])

  const handleViewportMove = useCallback(
    (_event: MouseEvent | TouchEvent | null, nextViewport: Viewport) => {
      setViewport(nextViewport)
    },
    []
  )

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary || !onCursorPositionChange || !reactFlowRef.current) {
        return
      }

      const nextPosition = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      onCursorPositionChange(nextPosition)
    },
    [onCursorPositionChange]
  )

  const handleNodeDrag = useCallback(
    (node: MapEditorFlowNode) => {
      if (!canEdit || !onNodeDragPositionChange) {
        return
      }

      onNodeDragPositionChange(node.id, node.position)
    },
    [canEdit, onNodeDragPositionChange]
  )

  const handleNodeDragStop = useCallback(
    (node: MapEditorFlowNode) => {
      if (!onNodeDragEnd) {
        return
      }

      onNodeDragEnd(node.id)
    },
    [onNodeDragEnd]
  )

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

  const handleFitView = useCallback(() => {
    reactFlowRef.current?.fitView({
      duration: 260,
      padding: 0.24,
    })
  }, [])

  const handleResetView = useCallback(() => {
    reactFlowRef.current?.setViewport(
      {
        x: 0,
        y: 0,
        zoom: 1,
      },
      { duration: 260 }
    )
  }, [])

  const handleCanvasDoubleClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!canEdit || !reactFlowRef.current) {
        return
      }

      if (!(event.target instanceof Element)) {
        return
      }

      if (
        event.target.closest(
          ".react-flow__node, .react-flow__edge, .react-flow__controls, .react-flow__minimap"
        )
      ) {
        return
      }

      event.preventDefault()

      const nextPosition = reactFlowRef.current.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      onAddNode({
        x: nextPosition.x - 90,
        y: nextPosition.y - 40,
      })
    },
    [canEdit, onAddNode]
  )

  useEffect(() => {
    if (isLoading) {
      hasInitialFitRef.current = false
      reactFlowRef.current = null
    }
  }, [isLoading])

  useEffect(() => {
    if (
      isLoading ||
      loadError ||
      flowReadyVersion === 0 ||
      !reactFlowRef.current ||
      hasInitialFitRef.current
    ) {
      return
    }

    if (nodes.length === 0) {
      return
    }

    let firstFrame = 0
    let secondFrame = 0

    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const bounds = flowContainerRef.current?.getBoundingClientRect()
        if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
          return
        }

        hasInitialFitRef.current = true
        reactFlowRef.current?.fitView({
          duration: 320,
          padding: 0.2,
        })
      })
    })

    return () => {
      cancelAnimationFrame(firstFrame)
      cancelAnimationFrame(secondFrame)
    }
  }, [flowReadyVersion, isLoading, loadError, nodes.length])

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
      if (event.defaultPrevented) {
        return
      }

      if (isEditableEventTarget(event.target)) {
        return
      }

      const normalizedKey = event.key.toLowerCase()
      const usesModifier = event.ctrlKey || event.metaKey

      if (canEdit && usesModifier && normalizedKey === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          onRedo()
          return
        }

        onUndo()
        return
      }

      if (canEdit && (usesModifier && normalizedKey === "y")) {
        event.preventDefault()
        onRedo()
        return
      }

      if (canEdit && hasSelection && (event.key === "Backspace" || event.key === "Delete")) {
        event.preventDefault()
        onDeleteSelection()
        return
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        return
      }

      if (canEdit && normalizedKey === "n") {
        event.preventDefault()
        handleAddNode()
        return
      }

      if (canEdit && normalizedKey === "o") {
        event.preventDefault()
        onOrganizeMap()
        return
      }

      if (normalizedKey === "f") {
        event.preventDefault()
        handleFitView()
        return
      }

      if (event.key === "0") {
        event.preventDefault()
        handleResetView()
        return
      }

      if (event.key === "?" || (event.shiftKey && event.key === "/")) {
        event.preventDefault()
        setShowHelp((prev) => !prev)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [
    canEdit,
    handleAddNode,
    handleFitView,
    handleResetView,
    hasSelection,
    onDeleteSelection,
    onOrganizeMap,
    onRedo,
    onUndo,
  ])

  const decoratedEdges = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        animated: Boolean(edge.selected),
        style: {
          ...edge.style,
          stroke: edge.selected
            ? "hsl(var(--primary) / 0.92)"
            : "hsl(var(--muted-foreground) / 0.58)",
          strokeWidth: edge.selected ? 2.4 : 1.8,
        },
      })),
    [edges]
  )

  const remoteNodeDragById = useMemo(() => {
    const nextRemoteNodeDragById = new Map<string, MapEditorRemoteNodeDrag>()

    for (const remoteNodeDrag of remoteNodeDrags) {
      nextRemoteNodeDragById.set(remoteNodeDrag.nodeId, remoteNodeDrag)
    }

    return nextRemoteNodeDragById
  }, [remoteNodeDrags])

  const renderedNodes = useMemo(() => {
    const nodesWithRemoteDrag =
      remoteNodeDragById.size === 0
        ? nodes
        : nodes.map((node) => {
      const remoteNodeDrag = remoteNodeDragById.get(node.id)
      if (!remoteNodeDrag) {
        return node
      }

      if (
        node.position.x === remoteNodeDrag.x &&
        node.position.y === remoteNodeDrag.y
      ) {
        return {
          ...node,
          style: {
            ...node.style,
            boxShadow: `0 0 0 2px ${remoteNodeDrag.color}66, 0 8px 20px rgba(15, 23, 42, 0.18)`,
          },
        }
      }

      return {
        ...node,
        position: {
          x: remoteNodeDrag.x,
          y: remoteNodeDrag.y,
        },
        style: {
          ...node.style,
          boxShadow: `0 0 0 2px ${remoteNodeDrag.color}66, 0 8px 20px rgba(15, 23, 42, 0.18)`,
        },
      }
    })

    return nodesWithRemoteDrag.map((node) => ({
      ...node,
      data: {
        ...node.data,
        isInlineEditing: inlineEditingNodeId === node.id,
        onInlineEditComplete: () => setInlineEditingNodeId(null),
        onInlineTitleChange: (title: string) => onUpdateNodeTitle(node.id, title),
      },
    }))
  }, [inlineEditingNodeId, nodes, onUpdateNodeTitle, remoteNodeDragById])

  const renderedRemoteNodeDragBadges = useMemo(() => {
    const nextBadges: RenderedRemoteNodeDragBadge[] = []

    for (const remoteNodeDrag of remoteNodeDrags) {
      const draggedNode = renderedNodes.find((node) => node.id === remoteNodeDrag.nodeId)
      if (!draggedNode) {
        continue
      }

      const nodeWidth = typeof draggedNode.width === "number" ? draggedNode.width : 180
      nextBadges.push({
        color: remoteNodeDrag.color,
        left: (remoteNodeDrag.x + nodeWidth / 2) * viewport.zoom + viewport.x,
        nodeId: remoteNodeDrag.nodeId,
        top: remoteNodeDrag.y * viewport.zoom + viewport.y,
        userId: remoteNodeDrag.userId,
        username: remoteNodeDrag.username,
      })
    }

    return nextBadges
  }, [remoteNodeDrags, renderedNodes, viewport.x, viewport.y, viewport.zoom])

  const renderedRemoteCursors = useMemo(
    () =>
      remoteCursors.map((cursor) => ({
        ...cursor,
        compactName: compactCursorName(cursor.username),
        initials: cursorInitials(cursor.username),
        left: cursor.x * viewport.zoom + viewport.x,
        top: cursor.y * viewport.zoom + viewport.y,
      })),
    [remoteCursors, viewport.x, viewport.y, viewport.zoom]
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
        <p className="mt-1 text-xs text-destructive/90">{loadError}</p>
        <Button className="mt-4" onClick={onRetryLoad} size="sm" variant="outline">
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-inner">
      <style>{reactFlowChromeStyles}</style>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border)/0.45)_1px,transparent_0)] [background-size:22px_22px]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/50 via-transparent to-background/60" />

      <div className="absolute left-2 top-2 z-20 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5 sm:left-3 sm:top-3 sm:max-w-[calc(100%-1.5rem)] sm:gap-2">
        {canEdit ? (
          <Button className="h-8 px-2.5" onClick={handleAddNode} size="sm" variant="secondary">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add node</span>
            <span className="sm:hidden">Add</span>
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            aria-label="Delete selected node or connection"
            className="h-8 px-2.5"
            disabled={!hasSelection}
            onClick={onDeleteSelection}
            size="sm"
            title="Delete selection"
            variant="outline"
          >
            <Trash2 className="size-4" />
            <span className="hidden min-[1100px]:inline">Delete selection</span>
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            aria-label="Undo latest change"
            className="h-8 px-2.5"
            disabled={!canUndo}
            onClick={onUndo}
            size="sm"
            title="Undo latest change"
            type="button"
            variant="outline"
          >
            <Undo2 className="size-4" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            aria-label="Redo latest change"
            className="h-8 px-2.5"
            disabled={!canRedo}
            onClick={onRedo}
            size="sm"
            title="Redo latest change"
            type="button"
            variant="outline"
          >
            <Redo2 className="size-4" />
          </Button>
        ) : null}
        {canEdit ? (
          <Button
            aria-label="Organize map"
            className="h-8 px-2.5"
            disabled={nodes.length < 2}
            onClick={onOrganizeMap}
            size="sm"
            title="Arrange nodes into connected columns"
            type="button"
            variant="outline"
          >
            <Network className="size-4" />
            <span className="hidden min-[1400px]:inline">Organize</span>
          </Button>
        ) : null}
        <Button
          aria-label="Fit map to screen"
          className="h-8 px-2.5"
          onClick={handleFitView}
          size="sm"
          title="Fit map to screen"
          type="button"
          variant="outline"
        >
          <LocateFixed className="size-4" />
          <span className="hidden min-[1400px]:inline">Fit</span>
        </Button>
        <Button
          aria-label="Reset view"
          className="h-8 px-2.5"
          onClick={handleResetView}
          size="sm"
          title="Reset view"
          type="button"
          variant="outline"
        >
          <RotateCcw className="size-4" />
        </Button>
        <Button
          aria-label="Keyboard shortcuts"
          className="h-8 px-2.5"
          onClick={() => setShowHelp((prev) => !prev)}
          size="sm"
          title="Keyboard shortcuts"
          type="button"
          variant="outline"
        >
          <HelpCircle className="size-4" />
        </Button>
      </div>

      {showHelp ? (
        <div className="absolute right-3 top-3 z-30 w-72 rounded-2xl border border-border/80 bg-card/97 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
              Keyboard shortcuts
            </p>
            <button
              aria-label="Close shortcuts panel"
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              onClick={() => setShowHelp(false)}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="p-4">
            <table className="w-full text-[11px]">
              <tbody className="divide-y divide-border/50">
                {[
                  { key: "N", label: "Add node" },
                  { key: "Del / Backspace", label: "Delete selection" },
                  { key: "Ctrl Z", label: "Undo" },
                  { key: "Ctrl Shift Z", label: "Redo" },
                  { key: "O", label: "Organize layout" },
                  { key: "F", label: "Fit map to screen" },
                  { key: "0", label: "Reset view" },
                  { key: "Double-click canvas", label: "Drop new node" },
                  { key: "?", label: "Toggle this panel" },
                ].map(({ key, label }) => (
                  <tr key={key}>
                    <td className="py-1.5 pr-3 font-medium text-foreground">{label}</td>
                    <td className="py-1.5 text-right">
                      <kbd className="inline-flex items-center rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {key}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10px] text-muted-foreground">
              Edit-only shortcuts require Admin or Editor role.
            </p>
          </div>
        </div>
      ) : null}

      <div
        className="h-full w-full"
        onPointerMove={handleCanvasPointerMove}
        ref={flowContainerRef}
      >
        <ReactFlow
          className="map-editor-flow"
          connectionRadius={28}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
            style: {
              stroke: "hsl(var(--muted-foreground) / 0.58)",
              strokeWidth: 1.8,
            },
            type: "mapEdge",
          }}
          deleteKeyCode={null}
          edgeTypes={edgeTypes}
          edges={decoratedEdges}
          edgesFocusable
          edgesUpdatable={canEdit}
          elementsSelectable
          minZoom={0.2}
          nodeTypes={nodeTypes}
          nodes={renderedNodes}
          nodesConnectable={canEdit}
          nodesDraggable={canEdit}
          onConnect={onConnect}
          onDoubleClick={handleCanvasDoubleClick}
          onEdgesChange={onEdgesChange}
          onInit={handleFlowInit}
          onMove={handleViewportMove}
          onNodeDoubleClick={(_event, node) => {
            if (!canEdit) {
              return
            }

            setInlineEditingNodeId(node.id)
          }}
          onNodeDrag={(_event, node) => handleNodeDrag(node as MapEditorFlowNode)}
          onNodeDragStop={(_event, node) =>
            handleNodeDragStop(node as MapEditorFlowNode)
          }
          onNodesChange={onNodesChange}
          onPaneClick={onClearSelection}
          onSelectionChange={onSelectionChange}
          proOptions={{ hideAttribution: true }}
          selectionOnDrag
          zoomOnDoubleClick={false}
        >
          <MiniMap
            className="!rounded-xl"
            maskColor="hsl(var(--background) / 0.72)"
            nodeBorderRadius={8}
            nodeColor="hsl(var(--primary) / 0.4)"
            nodeStrokeColor="hsl(var(--border) / 0.9)"
            pannable
            style={{
              backgroundColor: "hsl(var(--card) / 0.95)",
              border: "1px solid hsl(var(--border) / 0.8)",
            }}
            zoomable
          />
          <Controls className="!overflow-hidden !rounded-xl !border !border-border/80 !bg-card/95 !shadow-lg" />
          <Background color="hsl(var(--border) / 0.5)" gap={22} size={1} />
        </ReactFlow>
      </div>

      {renderedRemoteNodeDragBadges.map((remoteNodeDrag) => (
        <div
          className="pointer-events-none absolute z-[28]"
          key={`drag-${remoteNodeDrag.nodeId}-${remoteNodeDrag.userId}`}
          style={{
            left: remoteNodeDrag.left,
            top: remoteNodeDrag.top,
            transform: "translate(-50%, calc(-100% - 8px))",
          }}
        >
          <div
            className="inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border bg-card/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm"
            style={{ borderColor: `${remoteNodeDrag.color}66` }}
          >
            <span
              className="inline-flex size-2 rounded-full"
              style={{ backgroundColor: remoteNodeDrag.color }}
            />
            <span className="truncate">
              {remoteNodeBadgeCopy(remoteNodeDrag.username)}
            </span>
          </div>
        </div>
      ))}

      {renderedRemoteCursors.map((cursor) => (
        <div
          className="pointer-events-none absolute z-30"
          key={cursor.userId}
          style={{
            left: cursor.left,
            top: cursor.top,
            transform: "translate(-4px, -4px)",
          }}
        >
          <svg
            aria-hidden
            className="size-5 drop-shadow-[0_1px_1px_rgba(15,23,42,0.45)]"
            style={{ color: cursor.color }}
            viewBox="0 0 20 20"
          >
            <path
              d="M4 2.5v14l4.2-3.2 2.8 5.2 2.5-1.3-2.9-5.1h5.4z"
              fill="currentColor"
            />
            <path
              d="M4 2.5v14l4.2-3.2 2.8 5.2 2.5-1.3-2.9-5.1h5.4z"
              fill="none"
              stroke="hsl(var(--background))"
              strokeLinejoin="round"
              strokeWidth="1"
            />
          </svg>

          <div className="mt-1 inline-flex max-w-[12rem] items-center gap-1.5 rounded-full border border-border/70 bg-card/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm">
            <span
              className="inline-flex size-5 items-center justify-center rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: cursor.color }}
            >
              {cursor.initials}
            </span>
            <span className="truncate">{cursor.compactName}</span>
          </div>
        </div>
      ))}

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
              Double-click the canvas to drop an idea, then drag between handles to connect it.
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
