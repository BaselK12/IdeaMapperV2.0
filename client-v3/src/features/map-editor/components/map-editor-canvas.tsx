import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type OnSelectionChangeParams,
} from "reactflow"
import "reactflow/dist/style.css"

import { Button } from "@/components/ui/button"
import { MapEditorNode } from "@/features/map-editor/components/map-editor-node"
import type { MapEditorEdge, MapEditorNode as MapEditorFlowNode } from "@/features/map-editor/types/map-editor-types"

const nodeTypes = {
  mapNode: MapEditorNode,
}

type MapEditorCanvasProps = {
  canEdit: boolean
  edges: MapEditorEdge[]
  hasSelection: boolean
  isLoading: boolean
  loadError: string | null
  nodes: MapEditorFlowNode[]
  onAddNode: () => void
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
          <Button onClick={onAddNode} size="sm" variant="secondary">
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

      <div className="h-full w-full">
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
          deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null}
          edges={edges}
          edgesFocusable={canEdit}
          edgesUpdatable={canEdit}
          elementsSelectable
          fitView
          nodeTypes={nodeTypes}
          nodes={nodes}
          nodesConnectable={canEdit}
          nodesDraggable={canEdit}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
              Empty canvas
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Start with a single idea node, then connect related thoughts.
            </p>
            {canEdit ? (
              <Button className="mt-4" onClick={onAddNode} size="sm">
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
