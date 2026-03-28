import { useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  ArrowLeft,
  CalendarClock,
  CircleDot,
  Download,
  LayoutList,
  MoreHorizontal,
  Search,
  Share2,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  MapEditorCanvas,
  type MapEditorCanvasFocusRequest,
} from "@/features/map-editor/components/map-editor-canvas"
import { useMapEditor } from "@/features/map-editor/hooks/use-map-editor"
import type {
  MapEditorSaveStatus,
  MapEditorSyncStatus,
} from "@/features/map-editor/types/map-editor-types"
import { getNodeTitleFromValue } from "@/features/map-editor/utils/map-editor-graph"
import { MapWorkspaceParticipantStrip } from "@/features/map-workspace/components/map-workspace-participant-strip"
import {
  useMapWorkspaceLiveCursors,
  type MapWorkspaceRealtimeStatus,
} from "@/features/map-workspace/hooks/use-map-workspace-live-cursors"
import { useMapWorkspacePresence } from "@/features/map-workspace/hooks/use-map-workspace-presence"
import type { MapWorkspace } from "@/features/map-workspace/types/map-workspace-types"
import { cn } from "@/lib/utils"

type MapWorkspaceShellProps = {
  currentUser: User
  map: MapWorkspace
}

type NavigatorItem = {
  id: string
  title: string
}

type StatusPill = {
  className: string
  label: string
}

function formatRole(role: string) {
  if (role === "admin" || role === "editor" || role === "viewer") {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return "Member"
}

function roleClassName(role: string) {
  if (role === "admin") {
    return "border-violet-300/70 bg-violet-100 text-violet-700"
  }

  if (role === "editor") {
    return "border-blue-300/70 bg-blue-100 text-blue-700"
  }

  return "border-slate-300/70 bg-slate-100 text-slate-700"
}

function formatLastEdited(lastEdited: string | null) {
  if (!lastEdited) {
    return "Not available"
  }

  const parsedDate = new Date(lastEdited)
  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available"
  }

  return parsedDate.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function shortId(value: string) {
  if (value.length <= 12) {
    return value
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`
}

function saveStatusPill(status: MapEditorSaveStatus, canEdit: boolean): StatusPill {
  if (status === "error") {
    return {
      className: "border-destructive/35 bg-destructive/10 text-destructive",
      label: "Save failed",
    }
  }

  if (!canEdit) {
    return {
      className: "border-border/80 bg-background/90 text-muted-foreground",
      label: "View only",
    }
  }

  if (status === "dirty") {
    return {
      className: "border-orange-300/70 bg-orange-100 text-orange-700",
      label: "Unsaved edits",
    }
  }

  if (status === "saving") {
    return {
      className: "border-amber-300/70 bg-amber-100 text-amber-700",
      label: "Saving...",
    }
  }

  if (status === "saved") {
    return {
      className: "border-emerald-300/70 bg-emerald-100 text-emerald-700",
      label: "Saved",
    }
  }

  return {
    className: "border-border/80 bg-background/90 text-muted-foreground",
    label: "No local edits",
  }
}

function syncStatusPill(status: MapEditorSyncStatus): StatusPill {
  if (status === "error") {
    return {
      className: "border-amber-300/70 bg-amber-100 text-amber-700",
      label: "Realtime offline",
    }
  }

  if (status === "connecting") {
    return {
      className: "border-sky-300/70 bg-sky-100 text-sky-700",
      label: "Realtime reconnecting",
    }
  }

  return {
    className: "border-emerald-300/70 bg-emerald-100 text-emerald-700",
    label: "Realtime live",
  }
}

function liveCursorStatusPill(status: MapWorkspaceRealtimeStatus): StatusPill | null {
  if (status === "offline") {
    return {
      className: "border-amber-300/70 bg-amber-100 text-amber-700",
      label: "Cursors offline",
    }
  }

  if (status === "connecting") {
    return {
      className: "border-sky-300/70 bg-sky-100 text-sky-700",
      label: "Cursors reconnecting",
    }
  }

  return null
}

export function MapWorkspaceShell({ currentUser, map }: MapWorkspaceShellProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [focusRequest, setFocusRequest] = useState<MapEditorCanvasFocusRequest | null>(
    null
  )
  const editor = useMapEditor({ mapId: map.id, role: map.role })
  const mapPresence = useMapWorkspacePresence({
    currentUser,
    currentUserRole: map.role,
    mapId: map.id,
    ownerId: map.ownerId,
  })
  const liveCursors = useMapWorkspaceLiveCursors({
    currentUser,
    mapId: map.id,
  })
  const isReadOnly = !editor.canEdit
  const mapLastEdited = editor.lastEdited ?? map.lastEdited
  const savePill = saveStatusPill(editor.saveStatus, editor.canEdit)
  const syncPill = syncStatusPill(editor.syncStatus)
  const cursorPill = liveCursorStatusPill(liveCursors.realtimeStatus)

  const outlineItems = useMemo<NavigatorItem[]>(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    const sortedNodes = [...editor.nodes].sort((firstNode, secondNode) => {
      if (firstNode.position.y !== secondNode.position.y) {
        return firstNode.position.y - secondNode.position.y
      }

      return firstNode.position.x - secondNode.position.x
    })

    const mappedItems = sortedNodes.map((node, index) => ({
      id: node.id,
      title: getNodeTitleFromValue(node.data?.title, `Node ${index + 1}`),
    }))

    if (!normalizedTerm) {
      return mappedItems
    }

    return mappedItems.filter(
      (item) =>
        item.id.toLowerCase().includes(normalizedTerm) ||
        item.title.toLowerCase().includes(normalizedTerm)
    )
  }, [editor.nodes, searchTerm])

  const handleNavigatorSelect = (nodeId: string) => {
    editor.selectNode(nodeId)
    setFocusRequest((currentFocusRequest) => ({
      nodeId,
      requestKey: (currentFocusRequest?.requestKey ?? 0) + 1,
    }))
  }

  return (
    <section className="animate-fade-up flex h-[calc(100vh-2rem)] min-h-[640px] flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-lg">
      <header className="space-y-3 border-b border-border/70 px-4 py-3.5 md:px-5 md:py-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/app">
                <ArrowLeft className="size-4" />
                Dashboard
              </Link>
            </Button>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                roleClassName(map.role)
              )}
            >
              {formatRole(map.role)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Button className="h-8 px-3 text-xs" size="sm" variant="outline">
              <Share2 className="size-4" />
              Share
            </Button>
            <Button className="h-8 px-3 text-xs" size="sm" variant="outline">
              <Download className="size-4" />
              Export
            </Button>
            <Button className="h-8 px-3 text-xs" size="sm" variant="outline">
              <MoreHorizontal className="size-4" />
              More
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[2rem]">
            {map.name}
          </h1>
          <p className="line-clamp-2 max-w-3xl text-sm text-muted-foreground md:text-[15px]">
            {map.description || "No description added yet for this map."}
          </p>
        </div>

        <MapWorkspaceParticipantStrip
          errorMessage={mapPresence.errorMessage}
          isLoading={mapPresence.isLoading}
          isPresenceUnavailable={mapPresence.isPresenceUnavailable}
          onRetry={mapPresence.retry}
          participants={mapPresence.participants}
        />
      </header>

      <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 rounded-2xl border border-border/70 bg-background/85 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Navigator
          </p>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search nodes..."
              value={searchTerm}
            />
          </div>

          <div className="mt-4 space-y-2.5">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <LayoutList className="size-3.5" />
              Nodes
            </p>
            <ul className="space-y-1.5" data-testid="node-navigator-list">
              {outlineItems.length > 0 ? (
                outlineItems.map((item) => (
                  <li key={item.id}>
                    <button
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                        editor.selectedNode?.id === item.id
                          ? "bg-primary-soft text-foreground"
                          : "text-foreground/90 hover:bg-primary-soft/60"
                      )}
                      onClick={() => handleNavigatorSelect(item.id)}
                      type="button"
                    >
                      <CircleDot
                        className={cn(
                          "size-3.5",
                          editor.selectedNode?.id === item.id
                            ? "text-primary"
                            : "text-primary/75"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </button>
                  </li>
                ))
              ) : editor.nodes.length === 0 ? (
                <li className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-xs text-muted-foreground">
                  No nodes yet. Add your first node on the canvas.
                </li>
              ) : (
                <li className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-xs text-muted-foreground">
                  No nodes match your search.
                </li>
              )}
            </ul>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground">Map stats</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/80 bg-card px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Nodes</p>
                <p className="text-sm font-semibold text-foreground">{editor.nodeCount}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Edges</p>
                <p className="text-sm font-semibold text-foreground">{editor.edges.length}</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="relative min-h-[360px] overflow-hidden rounded-2xl border border-border/70 bg-background/85">
          <div className="relative flex h-full flex-col p-4 md:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                Canvas
              </span>
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                {formatRole(map.role)} access
              </span>
              <span className="rounded-full border border-border/80 bg-background/90 px-2.5 py-1">
                Last edited {formatLastEdited(mapLastEdited)}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  savePill.className
                )}
                data-testid="save-status-pill"
              >
                {savePill.label}
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1",
                  syncPill.className
                )}
              >
                {syncPill.label}
              </span>
              {cursorPill ? (
                <span className={cn("rounded-full border px-2.5 py-1", cursorPill.className)}>
                  {cursorPill.label}
                </span>
              ) : null}
              {editor.hasRemoteUpdateAvailable ? (
                <span className="rounded-full border border-orange-300/70 bg-orange-100 px-2.5 py-1 text-orange-700">
                  Newer saved version available
                </span>
              ) : null}
            </div>

            {editor.hasRemoteUpdateAvailable ? (
              <div className="mt-2 rounded-lg border border-orange-300/55 bg-orange-50 px-3 py-2">
                <p className="text-xs font-medium text-orange-700">
                  A newer saved version was published in another session.
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your local unsaved edits are still safe in this tab. Save to keep them,
                  or reload to replace them with the latest persisted graph.
                </p>
                <Button
                  className="mt-2 h-7 px-2.5 text-xs"
                  disabled={editor.saveStatus === "saving"}
                  onClick={editor.reloadFromRemote}
                  size="sm"
                  variant="outline"
                >
                  {editor.saveStatus === "saving" ? "Saving local edits..." : "Reload latest"}
                </Button>
              </div>
            ) : null}

            {editor.saveError ? (
              <div className="mt-2 rounded-lg border border-destructive/35 bg-destructive/5 px-3 py-2">
                <p className="text-xs font-medium text-destructive">Could not save latest edit</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{editor.saveError}</p>
                {editor.canEdit ? (
                  <Button className="mt-2 h-7 px-2.5 text-xs" onClick={editor.retrySave} size="sm" variant="outline">
                    Retry save
                  </Button>
                ) : null}
              </div>
            ) : null}

            {editor.selectionInvalidationNotice ? (
              <div className="mt-2 rounded-lg border border-sky-300/50 bg-sky-50 px-3 py-2">
                <p className="text-xs font-medium text-sky-800">Selection updated</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {editor.selectionInvalidationNotice}
                </p>
              </div>
            ) : null}

            {editor.syncError ? (
              <div className="mt-2 rounded-lg border border-amber-300/45 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-700">Realtime sync issue</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{editor.syncError}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Local editing and save still work while realtime reconnects.
                </p>
              </div>
            ) : null}

            {liveCursors.realtimeStatus === "offline" ? (
              <div className="mt-2 rounded-lg border border-amber-300/45 bg-amber-50 px-3 py-2">
                <p className="text-xs font-medium text-amber-700">Live cursors unavailable</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Cursor and drag previews are temporarily offline. Continue editing
                  normally; they return automatically after reconnect.
                </p>
              </div>
            ) : null}

            <div className="mt-3 min-h-0 flex-1">
              <MapEditorCanvas
                canEdit={editor.canEdit}
                edges={editor.edges}
                focusRequest={focusRequest}
                hasSelection={editor.hasSelection}
                isLoading={editor.isLoading}
                loadError={editor.loadError}
                nodes={editor.nodes}
                onAddNode={editor.addNode}
                onClearSelection={editor.clearSelection}
                onConnect={editor.handleConnect}
                onDeleteSelection={editor.deleteSelection}
                onEdgesChange={editor.handleEdgesChange}
                onNodesChange={editor.handleNodesChange}
                onCursorPositionChange={liveCursors.sendCursorPosition}
                onNodeDragEnd={liveCursors.endNodeDrag}
                onNodeDragPositionChange={liveCursors.sendNodeDragPosition}
                onRetryLoad={editor.retryLoad}
                onSelectionChange={editor.handleSelectionChange}
                remoteCursors={liveCursors.remoteCursors}
                remoteNodeDrags={liveCursors.remoteNodeDrags}
              />
            </div>
          </div>
        </main>

        <aside className="min-h-0 rounded-2xl border border-border/70 bg-background/85 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
            Inspector
          </p>

          {editor.selectedNode ? (
            <div className="mt-3 space-y-3 rounded-xl border border-border/80 bg-card/80 p-3.5">
              <p className="text-sm font-medium text-foreground">Selected node</p>
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">ID</p>
                <p className="font-medium text-foreground">{editor.selectedNode.id}</p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="selected-node-title">
                  Title
                </label>
                <Input
                  className="h-9"
                  disabled={isReadOnly}
                  id="selected-node-title"
                  onChange={(event) => editor.updateSelectedNodeTitle(event.target.value)}
                  value={editor.selectedNode.title}
                />
                {isReadOnly ? (
                  <p className="text-[11px] text-muted-foreground">
                    View-only access. Editors and admins can rename nodes.
                  </p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="text-muted-foreground">Position</p>
                  <p className="font-medium text-foreground">
                    {editor.selectedNode.position.x}, {editor.selectedNode.position.y}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="text-muted-foreground">Connections</p>
                  <p className="font-medium text-foreground">
                    {editor.selectedNode.incomingEdgeCount} in,{" "}
                    {editor.selectedNode.outgoingEdgeCount} out
                  </p>
                </div>
              </div>
            </div>
          ) : editor.selectedEdge ? (
            <div className="mt-3 space-y-2.5 rounded-xl border border-border/80 bg-card/80 p-3.5">
              <p className="text-sm font-medium text-foreground">Selected edge</p>
              <div className="space-y-1 text-xs">
                <p className="text-muted-foreground">ID</p>
                <p className="font-medium text-foreground">{editor.selectedEdge.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="text-muted-foreground">Source</p>
                  <p className="font-medium text-foreground">
                    {editor.selectedEdge.sourceNodeId}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/80 px-2.5 py-2">
                  <p className="text-muted-foreground">Target</p>
                  <p className="font-medium text-foreground">
                    {editor.selectedEdge.targetNodeId}
                  </p>
                </div>
              </div>
              {editor.selectedEdge.label ? (
                <div className="space-y-1 text-xs">
                  <p className="text-muted-foreground">Label</p>
                  <p className="font-medium text-foreground">{editor.selectedEdge.label}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-card/75 p-3.5">
              <p className="text-sm font-medium text-foreground">Nothing selected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a node in the canvas or navigator to inspect and edit details.
              </p>
            </div>
          )}

          <Separator className="my-4" />

          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Map ID</span>
              <span className="font-medium text-foreground">{shortId(map.id)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium text-foreground">{formatRole(map.role)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Nodes</span>
              <span className="font-medium text-foreground">{editor.nodeCount}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Last edited</span>
              <span className="font-medium text-foreground">
                {formatLastEdited(mapLastEdited)}
              </span>
            </div>
          </div>

          <Separator className="my-4" />

          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <CalendarClock className="size-3.5" />
              Description
            </p>
            <p className="rounded-xl border border-border/80 bg-card/75 px-3 py-2.5 text-xs text-muted-foreground">
              {map.description || "No description available yet."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}
