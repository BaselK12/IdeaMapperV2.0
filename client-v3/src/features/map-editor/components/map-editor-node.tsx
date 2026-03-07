import { Handle, Position, type NodeProps } from "reactflow"

import type { MapEditorNodeData } from "@/features/map-editor/types/map-editor-types"
import { cn } from "@/lib/utils"

export function MapEditorNode({ data, selected }: NodeProps<MapEditorNodeData>) {
  return (
    <div
      className={cn(
        "min-w-[180px] rounded-2xl border bg-card/95 px-3 py-2.5 shadow-sm transition-all",
        selected
          ? "border-primary/80 shadow-[0_0_0_2px_hsl(var(--primary-soft))]"
          : "border-border/80 hover:border-primary/40"
      )}
    >
      <Handle
        className="!h-2.5 !w-2.5 !border-background !bg-primary/80"
        position={Position.Left}
        type="target"
      />
      <Handle
        className="!h-2.5 !w-2.5 !border-background !bg-primary/80"
        position={Position.Right}
        type="source"
      />

      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/80">
        Node
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">
        {data.title || "Untitled node"}
      </p>
    </div>
  )
}
