import type { NodeProps } from "reactflow"

import type { MapEditorNodeData } from "@/features/map-editor/types/map-editor-types"
import { cn } from "@/lib/utils"

const frameBorderClass: Record<string, string> = {
  amber: "border-amber-400/50 bg-amber-50/20 dark:bg-amber-400/5",
  emerald: "border-emerald-400/50 bg-emerald-50/20 dark:bg-emerald-400/5",
  rose: "border-rose-400/50 bg-rose-50/20 dark:bg-rose-400/5",
  sky: "border-sky-400/50 bg-sky-50/20 dark:bg-sky-400/5",
  slate: "border-slate-400/50 bg-slate-50/20 dark:bg-slate-400/5",
  violet: "border-primary/40 bg-primary-soft/10",
}

const frameLabelClass: Record<string, string> = {
  amber: "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/20 dark:text-amber-200",
  emerald: "border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/20 dark:text-emerald-200",
  rose: "border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/20 dark:text-rose-200",
  sky: "border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/20 dark:text-sky-200",
  slate: "border-slate-300/70 bg-slate-100 text-slate-700 dark:border-slate-500/40 dark:bg-slate-400/20 dark:text-slate-200",
  violet: "border-primary/25 bg-primary-soft text-primary",
}

export function MapEditorFrameNode({ data }: NodeProps<MapEditorNodeData>) {
  const label = typeof data.title === "string" && data.title.trim() ? data.title.trim() : "Group"
  const color = data.color ?? "violet"
  const borderClass = frameBorderClass[color] ?? frameBorderClass.violet
  const labelClass = frameLabelClass[color] ?? frameLabelClass.violet
  const fw = typeof data.frameWidth === "number" ? data.frameWidth : 200
  const fh = typeof data.frameHeight === "number" ? data.frameHeight : 200

  return (
    <div
      className={cn("relative rounded-2xl border-2 border-dashed", borderClass)}
      style={{ height: fh, width: fw }}
    >
      <span
        className={cn(
          "absolute -top-3.5 left-4 max-w-[70%] truncate rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
          labelClass
        )}
      >
        {label}
      </span>
    </div>
  )
}
