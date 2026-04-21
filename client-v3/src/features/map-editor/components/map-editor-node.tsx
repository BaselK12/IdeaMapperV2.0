import { Handle, Position, type NodeProps } from "reactflow"

import type { MapEditorNodeData } from "@/features/map-editor/types/map-editor-types"
import { cn } from "@/lib/utils"

type InlineNodeData = MapEditorNodeData & {
  isInlineEditing?: boolean
  onInlineEditComplete?: () => void
  onInlineTitleChange?: (title: string) => void
}

const colorClassNames = {
  amber: {
    badge: "border-amber-300/70 bg-amber-100 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-200",
    border: "border-amber-300/80",
    dot: "bg-amber-500",
    selected: "shadow-[0_0_0_2px_rgba(245,158,11,0.22)]",
  },
  emerald: {
    badge: "border-emerald-300/70 bg-emerald-100 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200",
    border: "border-emerald-300/80",
    dot: "bg-emerald-500",
    selected: "shadow-[0_0_0_2px_rgba(16,185,129,0.22)]",
  },
  rose: {
    badge: "border-rose-300/70 bg-rose-100 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200",
    border: "border-rose-300/80",
    dot: "bg-rose-500",
    selected: "shadow-[0_0_0_2px_rgba(244,63,94,0.22)]",
  },
  sky: {
    badge: "border-sky-300/70 bg-sky-100 text-sky-800 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200",
    border: "border-sky-300/80",
    dot: "bg-sky-500",
    selected: "shadow-[0_0_0_2px_rgba(14,165,233,0.22)]",
  },
  slate: {
    badge: "border-slate-300/70 bg-slate-100 text-slate-800 dark:border-slate-500/40 dark:bg-slate-400/15 dark:text-slate-200",
    border: "border-slate-300/80",
    dot: "bg-slate-500",
    selected: "shadow-[0_0_0_2px_rgba(100,116,139,0.22)]",
  },
  violet: {
    badge: "border-primary/25 bg-primary-soft text-primary",
    border: "border-primary/45",
    dot: "bg-primary",
    selected: "shadow-[0_0_0_2px_hsl(var(--primary-soft))]",
  },
}

const kindLabels = {
  decision: "Decision",
  idea: "Idea",
  question: "Question",
  resource: "Resource",
  task: "Task",
}

function getYouTubeId(url: string) {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
  )
  return match?.[1] ?? null
}

function getVimeoId(url: string) {
  const match = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/)
  return match?.[1] ?? null
}

function getVideoEmbedUrl(url: string) {
  const youTubeId = getYouTubeId(url)
  if (youTubeId) {
    return `https://www.youtube.com/embed/${youTubeId}`
  }

  const vimeoId = getVimeoId(url)
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}`
  }

  return null
}

function isDirectVideoUrl(url: string) {
  return /\.(mp4|ogg|webm)(?:[?#].*)?$/i.test(url)
}

function isSafeHttpUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
  } catch {
    return false
  }
}

export function MapEditorNode({ data, selected }: NodeProps<MapEditorNodeData>) {
  const inlineData = data as InlineNodeData
  const color = data.color ?? "violet"
  const colorClasses = colorClassNames[color] ?? colorClassNames.violet
  const description = data.description?.trim()
  const kind = data.kind ?? "idea"
  const media = data.media ?? null
  const hasSafeMediaUrl = Boolean(media?.url && isSafeHttpUrl(media.url))
  const mediaTitle = media?.title?.trim() || media?.url || "Attached media"

  return (
    <div
      className={cn(
        "min-w-[210px] max-w-[280px] rounded-2xl border bg-card/95 px-3 py-2.5 shadow-sm transition-all",
        colorClasses.border,
        selected
          ? cn("bg-primary-soft/20", colorClasses.selected)
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

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            colorClasses.badge
          )}
        >
          <span className={cn("size-1.5 rounded-full", colorClasses.dot)} />
          {kindLabels[kind] ?? "Idea"}
        </span>
        {data.collapsed ? (
          <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Collapsed
          </span>
        ) : null}
      </div>

      {media && hasSafeMediaUrl ? (
        <div className="nodrag nowheel mt-2 overflow-hidden rounded-xl border border-border/80 bg-background/80">
          {media.type === "image" ? (
            <img
              alt={mediaTitle}
              className="h-28 w-full object-cover"
              loading="lazy"
              src={media.url}
            />
          ) : media.type === "video" && isDirectVideoUrl(media.url) ? (
            <video
              className="h-28 w-full bg-black object-cover"
              controls
              preload="metadata"
              src={media.url}
            />
          ) : media.type === "video" && getVideoEmbedUrl(media.url) ? (
            <iframe
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-32 w-full bg-black"
              src={getVideoEmbedUrl(media.url) ?? undefined}
              title={mediaTitle}
            />
          ) : (
            <a
              className="block px-3 py-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
              href={media.url}
              rel="noreferrer"
              target="_blank"
            >
              {mediaTitle}
            </a>
          )}
        </div>
      ) : null}

      {inlineData.isInlineEditing ? (
        <input
          autoFocus
          className="nodrag mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onBlur={() => inlineData.onInlineEditComplete?.()}
          onChange={(event) => inlineData.onInlineTitleChange?.(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault()
              inlineData.onInlineEditComplete?.()
            }
          }}
          value={data.title || ""}
        />
      ) : (
        <p className="mt-2 text-sm font-medium text-foreground">
          {data.title || "Untitled node"}
        </p>
      )}
      {description ? (
        <p className="mt-1 line-clamp-2 max-w-[18rem] text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}
