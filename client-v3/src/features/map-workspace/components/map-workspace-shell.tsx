import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"
import {
  ArrowLeft,
  CalendarClock,
  ChevronDown,
  CheckCircle2,
  CircleDot,
  Clipboard,
  Copy,
  Download,
  FileJson,
  FileText,
  Image,
  LayoutList,
  Link2,
  MoreHorizontal,
  Network,
  Palette,
  PencilLine,
  Presentation,
  Redo2,
  Search,
  Share2,
  Tag,
  Trash2,
  Undo2,
  Video,
} from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { getBuiltInBranchStarters } from "@/features/maps/api/map-presets"
import {
  MapDetailsModal,
  type MapDetailsFormValues,
} from "@/features/maps/components/map-details-modal"
import { ModalFrame } from "@/features/maps/components/modal-frame"
import {
  useCreateSeededMapMutation,
  useDeleteMapMutation,
  useUpdateMapDetailsMutation,
} from "@/features/maps/hooks/use-maps"
import {
  MapEditorCanvas,
  type MapEditorCanvasFocusRequest,
} from "@/features/map-editor/components/map-editor-canvas"
import { useMapEditor } from "@/features/map-editor/hooks/use-map-editor"
import type {
  MapEditorEdge,
  MapEditorNode,
  MapEditorNodeColor,
  MapEditorNodeKind,
  MapEditorNodeMedia,
  MapEditorNodeMediaType,
  MapEditorSaveStatus,
  MapEditorSyncStatus,
} from "@/features/map-editor/types/map-editor-types"
import {
  getNodeTitleFromValue,
  MAP_EDITOR_NODE_COLORS,
  MAP_EDITOR_NODE_KINDS,
} from "@/features/map-editor/utils/map-editor-graph"
import { MapWorkspaceParticipantStrip } from "@/features/map-workspace/components/map-workspace-participant-strip"
import {
  removeMapParticipant,
  updateMapParticipantRole,
} from "@/features/map-workspace/api/map-workspace-presence-api"
import {
  useMapWorkspaceLiveCursors,
  type MapWorkspaceRealtimeStatus,
} from "@/features/map-workspace/hooks/use-map-workspace-live-cursors"
import { useMapNodeComments } from "@/features/map-workspace/hooks/use-map-node-comments"
import { useMapWorkspacePresence } from "@/features/map-workspace/hooks/use-map-workspace-presence"
import type { MapNodeCommentMention } from "@/features/map-workspace/types/map-node-comments-types"
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

type WorkspaceDialog =
  | "branch-starter"
  | "delete"
  | "duplicate"
  | "export"
  | "map-details"
  | "more"
  | "share"
  | null

type WorkspaceToast = {
  id: number
  message: string
  tone: "info" | "success" | "warning"
}

const infoStatusClassName =
  "border-[hsl(var(--info-border))] bg-[hsl(var(--info-soft))] text-[hsl(var(--info-foreground))]"
const successStatusClassName =
  "border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] text-[hsl(var(--success-foreground))]"
const warningStatusClassName =
  "border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning-foreground))]"
const neutralStatusClassName =
  "border-border/80 bg-card/95 text-muted-foreground"
const builtInBranchStarters = getBuiltInBranchStarters()

function formatRole(role: string) {
  if (role === "admin" || role === "editor" || role === "viewer") {
    return role.charAt(0).toUpperCase() + role.slice(1)
  }

  return "Member"
}

function roleClassName(role: string) {
  if (role === "admin") {
    return "border-primary/25 bg-primary-soft/80 text-primary"
  }

  if (role === "editor") {
    return infoStatusClassName
  }

  return "border-border/80 bg-muted/70 text-muted-foreground"
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
      className: neutralStatusClassName,
      label: "View only",
    }
  }

  if (status === "dirty") {
    return {
      className: warningStatusClassName,
      label: "Saving soon",
    }
  }

  if (status === "saving") {
    return {
      className: infoStatusClassName,
      label: "Saving changes...",
    }
  }

  if (status === "saved") {
    return {
      className: successStatusClassName,
      label: "Saved",
    }
  }

  return {
    className: successStatusClassName,
    label: "All changes saved",
  }
}

function syncStatusPill(status: MapEditorSyncStatus): StatusPill {
  if (status === "error") {
    return {
      className: warningStatusClassName,
      label: "Solo mode",
    }
  }

  if (status === "connecting") {
    return {
      className: infoStatusClassName,
      label: "Live",
    }
  }

  return {
    className: successStatusClassName,
    label: "Live",
  }
}

function liveCursorStatusPill(status: MapWorkspaceRealtimeStatus): StatusPill | null {
  if (status === "offline") {
    return {
      className: warningStatusClassName,
      label: "Cursors paused",
    }
  }

  if (status === "connecting") {
    return null
  }

  return null
}

function formatOptionLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function normalizeOptionalText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function getCurrentUserDisplayName(currentUser: User) {
  const metadata = currentUser.user_metadata
  const metadataName =
    normalizeOptionalText(metadata?.full_name) ||
    normalizeOptionalText(metadata?.name) ||
    normalizeOptionalText(metadata?.username)

  return metadataName || normalizeOptionalText(currentUser.email?.split("@")[0]) || "You"
}

function formatCommentTimestamp(value: string) {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return "Just now"
  }

  return parsedDate.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

function extractTrailingMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([^\s@]*)$/)
  return match ? match[1].toLowerCase() : null
}

function insertTrailingMention(value: string, displayName: string) {
  const nextDisplayName = displayName.trim()
  if (!nextDisplayName) {
    return value
  }

  if (/(?:^|\s)@[^\s@]*$/.test(value)) {
    return value.replace(/(?:^|\s)@[^\s@]*$/, (match) => {
      const prefix = match.startsWith(" ") ? " " : ""
      return `${prefix}@${nextDisplayName} `
    })
  }

  return value ? `${value} @${nextDisplayName} ` : `@${nextDisplayName} `
}

function isMediaType(value: string): value is MapEditorNodeMediaType {
  return value === "image" || value === "link" || value === "video"
}

function getMapLink(mapId: string) {
  if (typeof window === "undefined") {
    return `/app/map/${mapId}`
  }

  return `${window.location.origin}/app/map/${mapId}`
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textArea = document.createElement("textarea")
  textArea.value = text
  textArea.setAttribute("readonly", "")
  textArea.style.position = "fixed"
  textArea.style.left = "-9999px"
  document.body.appendChild(textArea)
  textArea.select()

  try {
    document.execCommand("copy")
  } finally {
    document.body.removeChild(textArea)
  }
}

function sanitizeFilename(value: string) {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

  return sanitized || "branchly-map"
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function getEdgeTextField(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function isOpenableUrl(value: string) {
  try {
    const parsedUrl = new URL(value)
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
  } catch {
    return false
  }
}

function getCollapsedDescendantNodeIds(
  nodes: MapEditorNode[],
  edges: MapEditorEdge[]
) {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const outgoingTargetsByNode = new Map<string, string[]>()

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      continue
    }

    const outgoingTargets = outgoingTargetsByNode.get(edge.source) ?? []
    outgoingTargets.push(edge.target)
    outgoingTargetsByNode.set(edge.source, outgoingTargets)
  }

  const collapsedNodeIds = nodes
    .filter((node) => node.data?.collapsed === true)
    .map((node) => node.id)
  const hiddenNodeIds = new Set<string>()

  for (const collapsedNodeId of collapsedNodeIds) {
    const queue = [...(outgoingTargetsByNode.get(collapsedNodeId) ?? [])]

    for (let index = 0; index < queue.length; index += 1) {
      const nodeId = queue[index]
      if (hiddenNodeIds.has(nodeId) || nodeId === collapsedNodeId) {
        continue
      }

      hiddenNodeIds.add(nodeId)

      for (const targetNodeId of outgoingTargetsByNode.get(nodeId) ?? []) {
        queue.push(targetNodeId)
      }
    }
  }

  return hiddenNodeIds
}

export function MapWorkspaceShell({ currentUser, map }: MapWorkspaceShellProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const editorWorkspaceRef = useRef<HTMLDivElement | null>(null)
  const toastIdRef = useRef(0)
  const toastTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [commentDraft, setCommentDraft] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)
  const [focusRequest, setFocusRequest] = useState<MapEditorCanvasFocusRequest | null>(
    null
  )
  const [activeDialog, setActiveDialog] = useState<WorkspaceDialog>(null)
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [shareFeedback, setShareFeedback] = useState<string | null>(null)
  const [shareMemberError, setShareMemberError] = useState<string | null>(null)
  const [exportFeedback, setExportFeedback] = useState<string | null>(null)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [starterError, setStarterError] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [pendingRoleUserId, setPendingRoleUserId] = useState<string | null>(null)
  const [pendingRemoveUserId, setPendingRemoveUserId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<WorkspaceToast[]>([])
  const editor = useMapEditor({ mapId: map.id, role: map.role })
  const currentUserDisplayName = useMemo(
    () => getCurrentUserDisplayName(currentUser),
    [currentUser]
  )
  const nodeComments = useMapNodeComments({ mapId: map.id })
  const duplicateMapMutation = useCreateSeededMapMutation(currentUser.id)
  const updateMapDetailsMutation = useUpdateMapDetailsMutation(currentUser.id)
  const deleteMapMutation = useDeleteMapMutation(currentUser.id)
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
  const mapLink = useMemo(() => getMapLink(map.id), [map.id])
  const canEditMapDetails = editor.canEdit
  const canDuplicateMap = !editor.isLoading && !editor.loadError
  const canManageMembers = map.role === "admin"
  const canDeleteMap = map.ownerId === currentUser.id
  const selectedNodeTitle = editor.selectedNode?.title ?? ""
  const selectedNodeDescription = editor.selectedNode?.description ?? ""
  const selectedNodeMedia = editor.selectedNode?.media ?? null
  const selectedNodeThread = editor.selectedNode
    ? nodeComments.threads[editor.selectedNode.id] ?? null
    : null
  const selectedNodeComments = selectedNodeThread?.comments ?? []
  const commentMentionQuery = useMemo(
    () => extractTrailingMentionQuery(commentDraft),
    [commentDraft]
  )
  const mentionSuggestions = useMemo(() => {
    if (commentMentionQuery === null) {
      return []
    }

    const normalizedQuery = commentMentionQuery.trim().toLowerCase()
    return mapPresence.participants
      .filter((participant) => !participant.isCurrentUser)
      .filter((participant) =>
        normalizedQuery
          ? participant.displayName.toLowerCase().includes(normalizedQuery)
          : true
      )
      .slice(0, 5)
  }, [commentMentionQuery, mapPresence.participants])
  const hiddenNodeIds = useMemo(
    () => getCollapsedDescendantNodeIds(editor.nodes, editor.edges),
    [editor.edges, editor.nodes]
  )
  const visibleNodes = useMemo(
    () => editor.nodes.filter((node) => !hiddenNodeIds.has(node.id)),
    [editor.nodes, hiddenNodeIds]
  )
  const visibleEdges = useMemo(
    () =>
      editor.edges.filter(
        (edge) => !hiddenNodeIds.has(edge.source) && !hiddenNodeIds.has(edge.target)
      ),
    [editor.edges, hiddenNodeIds]
  )
  const hiddenNodeCount = hiddenNodeIds.size

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === editorWorkspaceRef.current)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    return () => {
      for (const timeout of toastTimeoutsRef.current) {
        clearTimeout(timeout)
      }

      toastTimeoutsRef.current = []
    }
  }, [])

  useEffect(() => {
    setCommentDraft("")
    setCommentError(null)
  }, [editor.selectedNode?.id])

  const publishToast = useCallback(
    (message: string, tone: WorkspaceToast["tone"] = "success") => {
      toastIdRef.current += 1
      const nextToast = {
        id: toastIdRef.current,
        message,
        tone,
      }

      setToasts((currentToasts) => [...currentToasts.slice(-2), nextToast])

      const timeout = setTimeout(() => {
        setToasts((currentToasts) =>
          currentToasts.filter((toast) => toast.id !== nextToast.id)
        )
      }, 3200)

      toastTimeoutsRef.current.push(timeout)
    },
    []
  )

  const outlineItems = useMemo<NavigatorItem[]>(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase()

    const sortedNodes = [...visibleNodes].sort((firstNode, secondNode) => {
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
  }, [searchTerm, visibleNodes])

  const handleNavigatorSelect = (nodeId: string) => {
    editor.selectNode(nodeId)
    setFocusRequest((currentFocusRequest) => ({
      nodeId,
      requestKey: (currentFocusRequest?.requestKey ?? 0) + 1,
    }))
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        publishToast("Fullscreen closed.", "info")
        return
      }

      await editorWorkspaceRef.current?.requestFullscreen()
      publishToast("Fullscreen opened.", "info")
    } catch {
      setIsFullscreen(false)
      publishToast("Fullscreen could not open in this browser.", "warning")
    }
  }

  const toggleFocusMode = () => {
    setIsFocusMode((currentValue) => {
      const nextValue = !currentValue
      publishToast(
        nextValue ? "Presentation mode on." : "Presentation mode off.",
        "info"
      )
      return nextValue
    })
  }

  const handleUndo = () => {
    if (!editor.canUndo) {
      return
    }

    editor.undoGraphChange()
    publishToast("Last map change undone.", "info")
  }

  const handleRedo = () => {
    if (!editor.canRedo) {
      return
    }

    editor.redoGraphChange()
    publishToast("Map change restored.", "info")
  }

  const handleOrganizeMap = () => {
    if (!editor.canEdit || editor.nodes.length < 2) {
      return
    }

    editor.organizeMap()
    publishToast("Map organized into connected columns.", "success")
  }

  const updateSelectedNodeMedia = (nextMedia: MapEditorNodeMedia | null) => {
    editor.updateSelectedNodeMedia(nextMedia)
  }

  const updateSelectedNodeMediaField = (
    field: keyof MapEditorNodeMedia,
    value: string
  ) => {
    const currentMedia = selectedNodeMedia
    const nextType =
      field === "type" && isMediaType(value)
        ? value
        : currentMedia?.type ?? "image"
    const nextUrl = field === "url" ? value : currentMedia?.url ?? ""
    const nextTitle = field === "title" ? value : currentMedia?.title ?? ""

    updateSelectedNodeMedia(
      nextUrl.trim()
        ? {
            ...(nextTitle.trim() ? { title: nextTitle } : {}),
            type: nextType,
            url: nextUrl,
          }
        : null
    )
  }

  const closeDialog = () => {
    if (
      duplicateMapMutation.isPending ||
      updateMapDetailsMutation.isPending ||
      deleteMapMutation.isPending
    ) {
      return
    }

    setActiveDialog(null)
    setDetailsError(null)
    setStarterError(null)
    setDuplicateError(null)
    setDeleteError(null)
    setShareMemberError(null)
  }

  const copyShareValue = async (value: string, successMessage: string) => {
    setShareFeedback(null)

    try {
      await copyTextToClipboard(value)
      setShareFeedback(successMessage)
      publishToast(successMessage)
    } catch {
      setShareFeedback("Could not copy automatically. Select and copy the value.")
      publishToast("Copy failed. Select the value manually.", "warning")
    }
  }

  const getNodeTitleById = (nodeId: string) => {
    const node = editor.nodes.find((currentNode) => currentNode.id === nodeId)
    return getNodeTitleFromValue(node?.data?.title, "Untitled node")
  }

  const buildTextSummary = () => {
    const nodeLines =
      editor.nodes.length > 0
        ? editor.nodes.map((node, index) => {
            const title = getNodeTitleFromValue(
              node.data?.title,
              `Node ${index + 1}`
            )
            const description =
              typeof node.data?.description === "string"
                ? node.data.description.trim()
                : ""
            const media = node.data.media
            const mediaText = media?.url ? ` [${media.type}: ${media.url}]` : ""
            return description
              ? `${index + 1}. ${title} - ${description}${mediaText}`
              : `${index + 1}. ${title}${mediaText}`
          })
        : ["No nodes yet."]

    const connectionLines =
      editor.edges.length > 0
        ? editor.edges.map((edge, index) => {
            const label = typeof edge.label === "string" ? edge.label.trim() : ""
            const note = getEdgeTextField(edge.data?.note)
            const link = getEdgeTextField(edge.data?.link)
            const details = [
              label ? ` (${label})` : "",
              note ? ` - ${note}` : "",
              link ? ` [link: ${link}]` : "",
            ].join("")

            return `${index + 1}. ${getNodeTitleById(edge.source)} -> ${getNodeTitleById(edge.target)}${details}`
          })
        : ["No connections yet."]

    return [
      `Branchly map: ${map.name}`,
      map.description ? `Description: ${map.description}` : null,
      `Exported: ${new Date().toLocaleString()}`,
      `Link: ${mapLink}`,
      "",
      `Nodes (${editor.nodes.length})`,
      ...nodeLines,
      "",
      `Connections (${editor.edges.length})`,
      ...connectionLines,
    ]
      .filter((line): line is string => line !== null)
      .join("\n")
  }

  const buildJsonExport = () =>
    JSON.stringify(
      {
        description: map.description,
        exportedAt: new Date().toISOString(),
        id: map.id,
        link: mapLink,
        name: map.name,
        nodes: editor.nodes.map((node, index) => ({
          color: node.data.color ?? "violet",
          description:
            typeof node.data?.description === "string"
              ? node.data.description
              : "",
          id: node.id,
          kind: node.data.kind ?? "idea",
          media: node.data.media ?? null,
          collapsed: node.data.collapsed === true,
          position: node.position,
          title: getNodeTitleFromValue(node.data?.title, `Node ${index + 1}`),
        })),
        connections: editor.edges.map((edge) => ({
          id: edge.id,
          label: typeof edge.label === "string" ? edge.label : "",
          link: getEdgeTextField(edge.data?.link),
          note: getEdgeTextField(edge.data?.note),
          source: edge.source,
          sourceTitle: getNodeTitleById(edge.source),
          target: edge.target,
          targetTitle: getNodeTitleById(edge.target),
        })),
      },
      null,
      2
    )

  const exportMap = (format: "json" | "text") => {
    const baseFilename = sanitizeFilename(map.name)

    if (format === "json") {
      downloadTextFile(
        `${baseFilename}.json`,
        buildJsonExport(),
        "application/json;charset=utf-8"
      )
      setExportFeedback("JSON export downloaded.")
      publishToast("JSON export downloaded.")
      return
    }

    downloadTextFile(
      `${baseFilename}-summary.txt`,
      buildTextSummary(),
      "text/plain;charset=utf-8"
    )
    setExportFeedback("Text summary downloaded.")
    publishToast("Text summary downloaded.")
  }

  const copyTextSummary = async () => {
    setExportFeedback(null)

    try {
      await copyTextToClipboard(buildTextSummary())
      setExportFeedback("Text summary copied.")
      publishToast("Text summary copied.")
    } catch {
      setExportFeedback("Could not copy automatically. Export the text file instead.")
      publishToast("Copy failed. Export the text file instead.", "warning")
    }
  }

  const handleUpdateMapDetails = async (values: MapDetailsFormValues) => {
    setDetailsError(null)

    try {
      const updatedMap = await updateMapDetailsMutation.mutateAsync({
        description: values.description,
        mapId: map.id,
        name: values.name,
      })

      queryClient.setQueryData<MapWorkspace>(
        ["map-workspace", map.id, currentUser.id],
        (currentMap) =>
          currentMap
            ? {
                ...currentMap,
                description: updatedMap.description,
                lastEdited: updatedMap.lastEdited,
                name: updatedMap.name,
              }
            : currentMap
      )
      setActiveDialog(null)
      publishToast("Map details updated.")
    } catch (error) {
      setDetailsError(
        error instanceof Error ? error.message : "Failed to update map."
      )
      publishToast("Map details could not be updated.", "warning")
    }
  }

  const handleDuplicateMap = async (values: MapDetailsFormValues) => {
    setDuplicateError(null)

    try {
      const duplicatedMapId = await duplicateMapMutation.mutateAsync({
        description: values.description,
        edges: editor.edges,
        name: values.name,
        nodes: editor.nodes,
      })

      setActiveDialog(null)
      navigate(`/app/map/${duplicatedMapId}`)
    } catch (error) {
      setDuplicateError(
        error instanceof Error ? error.message : "Failed to duplicate map."
      )
      publishToast("Map could not be duplicated.", "warning")
    }
  }

  const handleInsertBranchStarter = (starterId: string) => {
    if (!editor.selectedNode) {
      setStarterError("Choose a node before inserting a starter branch.")
      return
    }

    const starter =
      builtInBranchStarters.find((entry) => entry.id === starterId) ?? null
    if (!starter) {
      setStarterError("The selected starter is no longer available.")
      return
    }

    const anchorTitle = editor.selectedNode.title
    const insertedRootNodeId = editor.insertBranchStarter(starter)

    if (!insertedRootNodeId) {
      setStarterError("Starter branch could not be inserted on this node.")
      publishToast("Starter branch could not be inserted.", "warning")
      return
    }

    setStarterError(null)
    setActiveDialog(null)
    setFocusRequest((currentFocusRequest) => ({
      nodeId: insertedRootNodeId,
      requestKey: (currentFocusRequest?.requestKey ?? 0) + 1,
    }))
    publishToast(`${starter.name} added to ${anchorTitle}.`)
  }

  const handleInsertMention = (displayName: string) => {
    setCommentDraft((currentDraft) => insertTrailingMention(currentDraft, displayName))
  }

  const handleSubmitNodeComment = async () => {
    if (!editor.selectedNode) {
      setCommentError("Choose a node before adding a comment.")
      return
    }

    const nextBody = commentDraft.trim()
    if (!nextBody) {
      setCommentError("Enter a comment before posting.")
      return
    }

    setCommentError(null)

    const normalizedBody = nextBody.toLowerCase()
    const mentions: MapNodeCommentMention[] = mapPresence.participants
      .filter((participant) => !participant.isCurrentUser)
      .filter((participant) =>
        normalizedBody.includes(`@${participant.displayName.toLowerCase()}`)
      )
      .map((participant) => ({
        displayName: participant.displayName,
        userId: participant.id,
      }))

    const didAddComment = await nodeComments.addComment({
      authorId: currentUser.id,
      authorName: currentUserDisplayName,
      body: nextBody,
      mentions,
      nodeId: editor.selectedNode.id,
    })

    if (!didAddComment) {
      setCommentError(
        nodeComments.errorMessage ?? "Comment could not be added to this node."
      )
      publishToast("Node comment could not be added.", "warning")
      return
    }

    setCommentDraft("")
    publishToast("Node comment added.")
  }

  const handleToggleThreadResolved = async (isResolved: boolean) => {
    if (!editor.selectedNode || selectedNodeComments.length === 0) {
      return
    }

    setCommentError(null)

    const didUpdateThread = await nodeComments.setThreadResolved({
      actorId: currentUser.id,
      actorName: currentUserDisplayName,
      isResolved,
      nodeId: editor.selectedNode.id,
    })

    if (!didUpdateThread) {
      setCommentError(
        nodeComments.errorMessage ?? "Comment thread status could not be updated."
      )
      publishToast("Comment thread status could not be updated.", "warning")
      return
    }

    publishToast(isResolved ? "Comment thread resolved." : "Comment thread reopened.")
  }

  const handleParticipantRoleChange = async (
    participantUserId: string,
    nextRole: "admin" | "editor" | "viewer"
  ) => {
    setShareMemberError(null)
    setPendingRoleUserId(participantUserId)

    try {
      await updateMapParticipantRole({
        mapId: map.id,
        role: nextRole,
        userId: participantUserId,
      })

      mapPresence.refreshMembers()
      setShareFeedback("Member role updated.")
      publishToast("Member role updated.")
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : "Member role could not be updated."
      setShareMemberError(nextError)
      publishToast("Member role could not be updated.", "warning")
    } finally {
      setPendingRoleUserId(null)
    }
  }

  const handleRemoveMember = async (participantUserId: string) => {
    setShareMemberError(null)
    setPendingRemoveUserId(participantUserId)

    try {
      await removeMapParticipant({
        mapId: map.id,
        userId: participantUserId,
      })

      setShareFeedback("Member removed from the map.")
      publishToast("Member removed from the map.")
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : "Member could not be removed."
      setShareMemberError(nextError)
      publishToast("Member could not be removed.", "warning")
    } finally {
      setPendingRemoveUserId(null)
    }
  }

  const handleDeleteMap = async () => {
    setDeleteError(null)

    try {
      await deleteMapMutation.mutateAsync(map.id)
      navigate("/app", { replace: true })
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete map."
      )
      publishToast("Map could not be deleted.", "warning")
    }
  }

  return (
    <section
      className="animate-fade-up flex w-full flex-col rounded-2xl border border-border/70 bg-card/95 shadow-lg xl:h-[calc(100vh-2rem)] xl:min-h-[640px] xl:overflow-hidden"
    >
      <header className="sticky top-0 z-30 border-b border-border/70 bg-card/95 px-4 py-2 backdrop-blur md:px-5">
        <div className="flex items-center gap-2">
          <Button asChild className="shrink-0" size="sm" variant="ghost">
            <Link to="/app">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
          <span
            className={cn(
              "hidden shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
              roleClassName(map.role)
            )}
          >
            {formatRole(map.role)}
          </span>

          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-sm font-semibold text-foreground md:text-base">
              {map.name}
            </h1>
            {map.description ? (
              <p className="truncate text-[11px] text-muted-foreground">
                {map.description}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              aria-label="Share map"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setShareFeedback(null)
                setShareMemberError(null)
                setActiveDialog("share")
              }}
              size="sm"
              title="Share map"
              type="button"
              variant="outline"
            >
              <Share2 className="size-3.5" />
              <span className="hidden sm:inline">Share</span>
            </Button>
            <Button
              aria-label="Export map"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setExportFeedback(null)
                setActiveDialog("export")
              }}
              size="sm"
              title="Export map"
              type="button"
              variant="outline"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              aria-label="More map actions"
              className="h-7 px-2 text-[11px]"
              onClick={() => setActiveDialog("more")}
              size="sm"
              title="More map actions"
              type="button"
              variant="outline"
            >
              <MoreHorizontal className="size-3.5" />
              <span className="hidden sm:inline">More</span>
            </Button>
            <Button
              aria-label={isFocusMode ? "Exit presentation mode" : "Enter presentation mode"}
              className="h-7 px-2 text-[11px]"
              onClick={toggleFocusMode}
              size="sm"
              title={isFocusMode ? "Exit presentation mode" : "Enter presentation mode"}
              type="button"
              variant={isFocusMode ? "secondary" : "outline"}
            >
              <Presentation className="size-3.5" />
              <span className="hidden md:inline">
                {isFocusMode ? "Exit present" : "Present"}
              </span>
            </Button>
          </div>
        </div>

        {isFocusMode ? null : (
          <div className="mt-1.5">
            <MapWorkspaceParticipantStrip
              errorMessage={mapPresence.errorMessage}
              isLoading={mapPresence.isLoading}
              isPresenceUnavailable={mapPresence.isPresenceUnavailable}
              onRetry={mapPresence.retry}
              participants={mapPresence.participants}
            />
          </div>
        )}
      </header>

      <div
        className={cn(
          "grid xl:min-h-0 xl:flex-1",
          isFocusMode
            ? "gap-0 p-2 xl:grid-cols-1"
            : "gap-4 p-4 xl:grid-cols-[260px_minmax(0,1fr)]"
        )}
      >
        <aside
          className={cn(
            "order-2 flex flex-col rounded-2xl border border-border/70 bg-card/90 xl:order-none xl:min-h-0",
            isFocusMode && "hidden"
          )}
        >
          <div className="shrink-0 border-b border-border/60 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Navigator
            </p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          <div className="relative mt-0">
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
              ) : hiddenNodeCount > 0 && !searchTerm.trim() ? (
                <li className="rounded-lg border border-dashed border-border/80 px-3 py-2 text-xs text-muted-foreground">
                  Collapsed branches are hidden from the navigator.
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
              <div className="rounded-xl border border-border/80 bg-card/95 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Nodes</p>
                <p className="text-sm font-semibold text-foreground">{editor.nodeCount}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/95 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Edges</p>
                <p className="text-sm font-semibold text-foreground">{editor.edges.length}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/95 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Visible</p>
                <p className="text-sm font-semibold text-foreground">
                  {visibleNodes.length}
                </p>
              </div>
              <div className="rounded-xl border border-border/80 bg-card/95 px-2.5 py-2">
                <p className="text-[11px] text-muted-foreground">Hidden</p>
                <p className="text-sm font-semibold text-foreground">
                  {hiddenNodeCount}
                </p>
              </div>
            </div>
          </div>
          </div>
        </aside>

        <div
          className={cn(
            "order-1 grid min-w-0 min-h-[26rem] gap-4 xl:order-none xl:min-h-0",
            isFocusMode ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px]",
            isFullscreen && "h-screen min-h-screen overflow-hidden bg-card/95 p-4"
          )}
          ref={editorWorkspaceRef}
        >
          <main
            className={cn(
              "relative min-h-[26rem] overflow-hidden border border-border/70 bg-card/90 xl:min-h-[360px]",
              isFocusMode ? "rounded-xl" : "rounded-2xl"
            )}
          >
            <div
              className={cn(
                "relative flex min-h-[26rem] flex-col xl:h-full xl:min-h-0",
                isFocusMode ? "p-2 md:p-3" : "p-4 md:p-6"
              )}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/80 bg-card/95 px-2.5 py-1">
                  Canvas
                </span>
                {isFocusMode ? (
                  <span className={cn("rounded-full border px-2.5 py-1", infoStatusClassName)}>
                    Presentation mode
                  </span>
                ) : null}
                <span className="rounded-full border border-border/80 bg-card/95 px-2.5 py-1">
                  {formatRole(map.role)} access
                </span>
                <span className="rounded-full border border-border/80 bg-card/95 px-2.5 py-1">
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
                  <span className={cn("rounded-full border px-2.5 py-1", warningStatusClassName)}>
                    Newer saved version available
                  </span>
                ) : null}
                {hiddenNodeCount > 0 ? (
                  <span className="rounded-full border border-border/80 bg-card/95 px-2.5 py-1">
                    {hiddenNodeCount} hidden in collapsed branches
                  </span>
                ) : null}
              </div>

              {editor.hasRemoteUpdateAvailable ? (
                <div className={cn("mt-2 rounded-lg border px-3 py-2", warningStatusClassName)}>
                  <p className="text-xs font-medium">
                    A newer saved version was published in another session.
                  </p>
                  <p className="mt-0.5 text-xs opacity-90">
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
                <div className="mt-2 rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-destructive">
                  <p className="text-xs font-medium">Could not save latest edit</p>
                  <p className="mt-0.5 text-xs opacity-90">{editor.saveError}</p>
                  {editor.canEdit ? (
                    <Button className="mt-2 h-7 px-2.5 text-xs" onClick={editor.retrySave} size="sm" variant="outline">
                      Retry save
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {editor.selectionInvalidationNotice ? (
                <div className={cn("mt-2 rounded-lg border px-3 py-2", infoStatusClassName)}>
                  <p className="text-xs font-medium">Selection updated</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    {editor.selectionInvalidationNotice}
                  </p>
                </div>
              ) : null}

              {editor.syncError ? (
                <div className={cn("mt-2 rounded-lg border px-3 py-2", warningStatusClassName)}>
                  <p className="text-xs font-medium">Live collaboration is reconnecting</p>
                  <p className="mt-0.5 text-xs opacity-90">{editor.syncError}</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    You can keep editing; changes still save from this tab.
                  </p>
                </div>
              ) : null}

              {liveCursors.realtimeStatus === "offline" ? (
                <div className={cn("mt-2 rounded-lg border px-3 py-2", warningStatusClassName)}>
                  <p className="text-xs font-medium">Live cursors are paused</p>
                  <p className="mt-0.5 text-xs opacity-90">
                    Cursor previews will return automatically when the live channel reconnects.
                  </p>
                </div>
              ) : null}

              {isFocusMode ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  <span>
                    Navigator and inspector are tucked away for presenting. Use F to fit
                    the map or 0 to reset the view.
                  </span>
                  <Button
                    className="h-7 px-2.5 text-xs"
                    onClick={toggleFocusMode}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    Exit presentation
                  </Button>
                </div>
              ) : null}

              <div className="relative mt-3 h-[22rem] sm:h-[26rem] xl:h-auto xl:min-h-0 xl:flex-1">
                <MapEditorCanvas
                  canRedo={editor.canRedo}
                  canEdit={editor.canEdit}
                  canUndo={editor.canUndo}
                  edges={visibleEdges}
                  focusRequest={focusRequest}
                  hasSelection={editor.hasSelection}
                  isFullscreen={isFullscreen}
                  isLoading={editor.isLoading}
                  loadError={editor.loadError}
                  nodes={visibleNodes}
                  onAddNode={editor.addNode}
                  onClearSelection={editor.clearSelection}
                  onConnect={editor.handleConnect}
                  onDeleteSelection={editor.deleteSelection}
                  onEdgesChange={editor.handleEdgesChange}
                  onNodesChange={editor.handleNodesChange}
                  onOrganizeMap={handleOrganizeMap}
                  onRedo={handleRedo}
                  onCursorPositionChange={liveCursors.sendCursorPosition}
                  onNodeDragEnd={liveCursors.endNodeDrag}
                  onNodeDragPositionChange={liveCursors.sendNodeDragPosition}
                  onToggleFullscreen={() => {
                    void toggleFullscreen()
                  }}
                  onRetryLoad={editor.retryLoad}
                  onSelectionChange={editor.handleSelectionChange}
                  onUndo={handleUndo}
                  onUpdateNodeTitle={editor.updateNodeTitle}
                  remoteCursors={liveCursors.remoteCursors}
                  remoteNodeDrags={liveCursors.remoteNodeDrags}
                />
              </div>
            </div>
          </main>

          <aside
            className={cn(
              "order-3 flex flex-col rounded-2xl border border-border/70 bg-card/90 xl:min-h-0",
              isFocusMode && "hidden"
            )}
          >
            <div className="shrink-0 border-b border-border/60 px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Inspector
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {editor.selectedNode ? (
            <div className="mt-3 space-y-3 rounded-xl border border-border/80 bg-card/95 p-3.5">
              <p className="text-sm font-medium text-foreground">Selected node</p>
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
              {editor.selectedNode.outgoingEdgeCount > 0 ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/80 px-2.5 py-1.5">
                  <span className="text-xs text-muted-foreground">
                    Branch ({editor.selectedNode.outgoingEdgeCount} outgoing)
                  </span>
                  <Button
                    className="h-7 px-2.5 text-[11px]"
                    disabled={isReadOnly}
                    onClick={() => {
                      editor.updateSelectedNodeCollapsed(
                        !editor.selectedNode?.collapsed
                      )
                      publishToast(
                        editor.selectedNode?.collapsed
                          ? "Branch expanded."
                          : "Branch collapsed.",
                        "info"
                      )
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {editor.selectedNode.collapsed ? "Expand" : "Collapse"}
                  </Button>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    htmlFor="selected-node-kind"
                  >
                    <Tag className="size-3.5" />
                    Type
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isReadOnly}
                    id="selected-node-kind"
                    onChange={(event) =>
                      editor.updateSelectedNodeAppearance({
                        kind: event.target.value as MapEditorNodeKind,
                      })
                    }
                    value={editor.selectedNode.kind}
                  >
                    {MAP_EDITOR_NODE_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {formatOptionLabel(kind)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    htmlFor="selected-node-color"
                  >
                    <Palette className="size-3.5" />
                    Color
                  </label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isReadOnly}
                    id="selected-node-color"
                    onChange={(event) =>
                      editor.updateSelectedNodeAppearance({
                        color: event.target.value as MapEditorNodeColor,
                      })
                    }
                    value={editor.selectedNode.color}
                  >
                    {MAP_EDITOR_NODE_COLORS.map((color) => (
                      <option key={color} value={color}>
                        {formatOptionLabel(color)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs text-muted-foreground"
                  htmlFor="selected-node-description"
                >
                  Description
                </label>
                <textarea
                  className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isReadOnly}
                  id="selected-node-description"
                  maxLength={360}
                  onChange={(event) =>
                    editor.updateSelectedNodeDescription(event.target.value)
                  }
                  placeholder="Add a short note, decision, or context."
                  value={selectedNodeDescription}
                />
              </div>
              <div className="rounded-lg border border-border/80 bg-background/80 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Branch starters
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Attach a built-in branch structure to this selected node.
                    </p>
                  </div>
                  <Button
                    className="h-7 px-2.5 text-[11px]"
                    disabled={isReadOnly}
                    onClick={() => {
                      setStarterError(null)
                      setActiveDialog("branch-starter")
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <LayoutList className="size-3.5" />
                    Insert
                  </Button>
                </div>
                {isReadOnly ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Viewer access can read the map but cannot attach starter branches.
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-border/80 bg-background/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      Node comments
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Async discussion for this node only.
                    </p>
                  </div>
                  {selectedNodeComments.length > 0 ? (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        selectedNodeThread?.isResolved
                          ? successStatusClassName
                          : infoStatusClassName
                      )}
                    >
                      {selectedNodeThread?.isResolved ? "Resolved" : "Open"}
                    </span>
                  ) : null}
                </div>

                {nodeComments.isLoading ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Loading node comments...
                  </p>
                ) : selectedNodeComments.length > 0 ? (
                  <div className="mt-3 space-y-2.5">
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {selectedNodeComments.map((comment) => (
                        <div
                          className="rounded-lg border border-border/80 bg-card/95 px-3 py-2.5"
                          key={comment.id}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-medium text-foreground">
                              {comment.authorName}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatCommentTimestamp(comment.createdAt)}
                            </p>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                            {comment.body}
                          </p>
                          {comment.mentions.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {comment.mentions.map((mention) => (
                                <span
                                  className="rounded-full border border-primary/20 bg-primary-soft/35 px-2 py-0.5 text-[10px] font-medium text-primary"
                                  key={`${comment.id}-${mention.userId}`}
                                >
                                  @{mention.displayName}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    {selectedNodeThread?.isResolved ? (
                      <p className="text-[11px] text-muted-foreground">
                        Resolved by{" "}
                        <span className="font-medium text-foreground">
                          {selectedNodeThread.resolvedByName || "a collaborator"}
                        </span>{" "}
                        {selectedNodeThread.resolvedAt
                          ? `on ${formatCommentTimestamp(selectedNodeThread.resolvedAt)}`
                          : ""}
                        .
                      </p>
                    ) : null}

                    {!isReadOnly ? (
                      <div className="flex justify-end">
                        <Button
                          className="h-7 px-2.5 text-[11px]"
                          disabled={nodeComments.isSaving}
                          onClick={() => {
                            void handleToggleThreadResolved(
                              !(selectedNodeThread?.isResolved ?? false)
                            )
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          {nodeComments.isSaving
                            ? "Working..."
                            : selectedNodeThread?.isResolved
                              ? "Reopen thread"
                              : "Resolve thread"}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    No comments yet. Add one to keep discussion attached to this node.
                  </p>
                )}

                {nodeComments.errorMessage || commentError ? (
                  <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                    <p className="text-sm text-destructive">
                      {commentError ?? nodeComments.errorMessage}
                    </p>
                    {nodeComments.errorMessage ? (
                      <Button
                        className="mt-2 h-7 px-2.5 text-[11px]"
                        onClick={nodeComments.retryLoad}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        Retry comments
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-3 space-y-2">
                  <textarea
                    className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isReadOnly || nodeComments.isSaving}
                    maxLength={600}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder={
                      isReadOnly
                        ? "Viewer access can read comments but cannot add new ones."
                        : "Add context, a decision, or a follow-up. Type @ to mention a collaborator."
                    }
                    value={commentDraft}
                  />

                  {commentMentionQuery !== null ? (
                    mentionSuggestions.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {mentionSuggestions.map((participant) => (
                          <button
                            className="rounded-full border border-border/80 bg-card px-2 py-1 text-[11px] text-foreground transition-colors hover:bg-primary-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            key={participant.id}
                            onClick={() => handleInsertMention(participant.displayName)}
                            type="button"
                          >
                            @{participant.displayName}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        No collaborator matches that mention.
                      </p>
                    )
                  ) : null}

                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground">
                      {isReadOnly
                        ? "Comments stay readable in view-only mode."
                        : "Comment changes are durable and visible to collaborators in this map."}
                    </p>
                    <Button
                      className="h-8 px-3 text-xs"
                      disabled={isReadOnly || nodeComments.isSaving || !commentDraft.trim()}
                      onClick={() => {
                        void handleSubmitNodeComment()
                      }}
                      size="sm"
                      type="button"
                    >
                      {nodeComments.isSaving ? "Posting..." : "Post comment"}
                    </Button>
                  </div>
                </div>
              </div>
              <details className="group rounded-xl border border-border/80 bg-background/70">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
                  <span>Advanced details</span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/75">
                    Media, links
                    <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
                  </span>
                </summary>
                <div className="space-y-3 border-t border-border/70 p-3">
                  <div className="space-y-2">
                    <p className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                      {selectedNodeMedia?.type === "video" ? (
                        <Video className="size-3.5" />
                      ) : selectedNodeMedia?.type === "link" ? (
                        <Link2 className="size-3.5" />
                      ) : (
                        <Image className="size-3.5" />
                      )}
                      Node media
                    </p>
                    <div className="grid gap-2">
                      <select
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={isReadOnly}
                        onChange={(event) =>
                          updateSelectedNodeMediaField("type", event.target.value)
                        }
                        value={selectedNodeMedia?.type ?? "image"}
                      >
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="link">Link</option>
                      </select>
                      <Input
                        className="h-9"
                        disabled={isReadOnly}
                        onChange={(event) =>
                          updateSelectedNodeMediaField("url", event.target.value)
                        }
                        placeholder="Paste a public URL"
                        value={selectedNodeMedia?.url ?? ""}
                      />
                    </div>
                    <Input
                      className="h-9"
                      disabled={isReadOnly || !selectedNodeMedia?.url}
                      onChange={(event) =>
                        updateSelectedNodeMediaField("title", event.target.value)
                      }
                      placeholder="Media title"
                      value={selectedNodeMedia?.title ?? ""}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Images, YouTube/Vimeo links, and direct video files preview on the node.
                      </p>
                      {selectedNodeMedia ? (
                        <Button
                          className="h-7 px-2 text-[11px]"
                          disabled={isReadOnly}
                          onClick={() => {
                            updateSelectedNodeMedia(null)
                            publishToast("Node media removed.", "info")
                          }}
                          size="sm"
                          type="button"
                          variant="outline"
                        >
                          Remove
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-background/95 px-2.5 py-2 text-xs">
                    <p className="text-muted-foreground">Connections</p>
                    <p className="font-medium text-foreground">
                      {editor.selectedNode.incomingEdgeCount} incoming,{" "}
                      {editor.selectedNode.outgoingEdgeCount} outgoing
                    </p>
                  </div>
                </div>
              </details>
            </div>
          ) : editor.selectedEdge ? (
            <div className="mt-3 space-y-2.5 rounded-xl border border-border/80 bg-card/95 p-3.5">
              <p className="text-sm font-medium text-foreground">
                Selected connection
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg border border-border/80 bg-background/95 px-2.5 py-2">
                  <p className="text-muted-foreground">From</p>
                  <p className="font-medium text-foreground">
                    {getNodeTitleById(editor.selectedEdge.sourceNodeId)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/80 bg-background/95 px-2.5 py-2">
                  <p className="text-muted-foreground">To</p>
                  <p className="font-medium text-foreground">
                    {getNodeTitleById(editor.selectedEdge.targetNodeId)}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="selected-edge-label">
                  Label
                </label>
                <Input
                  className="h-9"
                  disabled={isReadOnly}
                  id="selected-edge-label"
                  onChange={(event) =>
                    editor.updateSelectedEdgeLabel(event.target.value)
                  }
                  placeholder="e.g. supports, blocks, depends on"
                  value={editor.selectedEdge.label}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="selected-edge-note">
                  Connection note
                </label>
                <textarea
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isReadOnly}
                  id="selected-edge-note"
                  maxLength={280}
                  onChange={(event) =>
                    editor.updateSelectedEdgeDetails({ note: event.target.value })
                  }
                  placeholder="Add why this relationship matters."
                  value={editor.selectedEdge.note}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground" htmlFor="selected-edge-link">
                  Reference link
                </label>
                <Input
                  className="h-9"
                  disabled={isReadOnly}
                  id="selected-edge-link"
                  onChange={(event) =>
                    editor.updateSelectedEdgeDetails({ link: event.target.value })
                  }
                  placeholder="https://example.com/source"
                  value={editor.selectedEdge.link}
                />
                {isOpenableUrl(editor.selectedEdge.link) ? (
                  <a
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    href={editor.selectedEdge.link}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <Link2 className="size-3.5" />
                    Open reference
                  </a>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Notes and links show a details badge on the connection.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-xl border border-dashed border-border/80 bg-card/90 p-3.5">
              <p className="text-sm font-medium text-foreground">Nothing selected</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose a node in the canvas or navigator to inspect and edit details.
              </p>
            </div>
          )}

          <details className="group mt-3 rounded-xl border border-border/80 bg-card/90">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <CalendarClock className="size-3.5" />
                Map context
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/75">
                {formatRole(map.role)}
                <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="space-y-4 border-t border-border/70 px-3.5 py-3">
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Access</span>
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
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Map description
                </p>
                <p className="rounded-xl border border-border/80 bg-background/80 px-3 py-2.5 text-xs text-muted-foreground">
                  {map.description ||
                    (canEditMapDetails
                      ? "Add a description from More > Edit details."
                      : "No description has been added yet.")}
                </p>
              </div>
            </div>
          </details>
            </div>
          </aside>
        </div>
      </div>
      {toasts.length > 0 ? (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
          {toasts.map((toast) => (
            <div
              className={cn(
                "rounded-xl border px-3 py-2.5 text-sm shadow-lg backdrop-blur",
                toast.tone === "success"
                  ? successStatusClassName
                  : toast.tone === "warning"
                    ? warningStatusClassName
                    : infoStatusClassName
              )}
              key={toast.id}
            >
              <p className="font-medium">{toast.message}</p>
            </div>
          ))}
        </div>
      ) : null}

      <ModalFrame
        description="Share this workspace with someone who already has Branchly access."
        onClose={closeDialog}
        open={activeDialog === "share"}
        title="Share map"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-border/80 bg-background/80 px-3 py-3">
            <p className="text-sm font-medium text-foreground">Sharing flow</p>
            <div className="mt-2 space-y-2 text-sm text-muted-foreground">
              <p>
                1. Share the map link or invite code with someone who already has
                Branchly access.
              </p>
              <p>
                2. They join from the dashboard, then appear here so admins can
                adjust access if needed.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="text-sm font-medium text-foreground" htmlFor="share-map-link">
              Map link
            </label>
            <div className="flex gap-2">
              <Input id="share-map-link" readOnly value={mapLink} />
              <Button
                onClick={() => {
                  void copyShareValue(mapLink, "Map link copied.")
                }}
                type="button"
                variant="outline"
              >
                <Clipboard className="size-4" />
                Copy
              </Button>
            </div>
          </div>

          <div className="space-y-2.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="share-invite-code"
            >
              Invite code
            </label>
            <div className="flex gap-2">
              <Input id="share-invite-code" readOnly value={map.id} />
              <Button
                onClick={() => {
                  void copyShareValue(map.id, "Invite code copied.")
                }}
                type="button"
                variant="outline"
              >
                <Clipboard className="size-4" />
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Invite code {shortId(map.id)} pairs with the map name: {map.name}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Members</p>
                <p className="text-xs text-muted-foreground">
                  {canManageMembers
                    ? "Admins can update roles or remove members here."
                    : "Admins can manage roles and members from this panel."}
                </p>
              </div>
              <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {mapPresence.participants.length} members
              </span>
            </div>

            {mapPresence.isLoading ? (
              <p className="rounded-xl border border-border/80 bg-background/70 px-3 py-3 text-sm text-muted-foreground">
                Loading members...
              </p>
            ) : mapPresence.errorMessage ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-3">
                <p className="text-sm text-destructive">{mapPresence.errorMessage}</p>
                <Button
                  className="mt-2 h-7 px-2.5 text-[11px]"
                  onClick={mapPresence.retry}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Retry members
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {mapPresence.participants.map((participant) => {
                  const isOwner = participant.id === map.ownerId
                  const isProtectedMember = isOwner || participant.isCurrentUser
                  const isRolePending = pendingRoleUserId === participant.id
                  const isRemovalPending = pendingRemoveUserId === participant.id

                  return (
                    <div
                      className="rounded-xl border border-border/80 bg-card/95 px-3 py-3"
                      key={participant.id}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {participant.displayName}
                            </p>
                            {participant.isCurrentUser ? (
                              <span className="rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                You
                              </span>
                            ) : null}
                            {isOwner ? (
                              <span className="rounded-full border border-primary/20 bg-primary-soft/30 px-2 py-0.5 text-[10px] font-medium text-primary">
                                Owner
                              </span>
                            ) : null}
                            <span
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                                roleClassName(participant.role)
                              )}
                            >
                              {formatRole(participant.role)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {participant.presence === "online"
                              ? "Online now"
                              : participant.presence === "offline"
                                ? "Offline"
                                : "Presence unavailable"}
                          </p>
                        </div>

                        {canManageMembers ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {isOwner ? (
                              <span className="text-xs text-muted-foreground">
                                Owner access stays Admin.
                              </span>
                            ) : (
                              <select
                                className="h-9 min-w-28 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isProtectedMember || isRolePending || isRemovalPending}
                                onChange={(event) => {
                                  void handleParticipantRoleChange(
                                    participant.id,
                                    event.target.value as "admin" | "editor" | "viewer"
                                  )
                                }}
                                value={participant.role}
                              >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                                <option value="admin">Admin</option>
                              </select>
                            )}

                            {!isProtectedMember ? (
                              <Button
                                className="h-9 px-3 text-xs"
                                disabled={isRolePending || isRemovalPending}
                                onClick={() => {
                                  void handleRemoveMember(participant.id)
                                }}
                                type="button"
                                variant="outline"
                              >
                                {isRemovalPending ? "Removing..." : "Remove"}
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {shareMemberError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {shareMemberError}
            </p>
          ) : null}

          {shareFeedback ? (
            <p className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success-foreground))]">
              <CheckCircle2 className="size-4" />
              {shareFeedback}
            </p>
          ) : null}
        </div>
      </ModalFrame>

      <ModalFrame
        description={
          selectedNodeTitle
            ? `Attach a built-in branch to ${selectedNodeTitle}. The new branch stays separate from the original starter preset.`
            : "Attach a built-in branch starter to the selected node."
        }
        onClose={closeDialog}
        open={activeDialog === "branch-starter"}
        title="Insert branch starter"
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            {builtInBranchStarters.map((starter) => (
              <button
                className="rounded-xl border border-border/80 bg-card/95 px-3 py-3 text-left transition-colors hover:bg-primary-soft/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                key={starter.id}
                onClick={() => handleInsertBranchStarter(starter.id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      {starter.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {starter.summary}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border/80 bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {starter.graph.nodes.length} nodes
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {starter.description}
                </p>
              </button>
            ))}
          </div>

          {starterError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {starterError}
            </p>
          ) : null}
        </div>
      </ModalFrame>

      <ModalFrame
        description="Download this map for a report, backup, or presentation handout."
        onClose={closeDialog}
        open={activeDialog === "export"}
        title="Export map"
      >
        <div className="space-y-4">
          <button
            className="flex w-full items-start gap-3 rounded-xl border border-border/80 bg-card/95 px-3 py-3 text-left transition-colors hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => exportMap("json")}
            type="button"
          >
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileJson className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                JSON data
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Includes map details, nodes, descriptions, and connections.
              </span>
            </span>
          </button>

          <button
            className="flex w-full items-start gap-3 rounded-xl border border-border/80 bg-card/95 px-3 py-3 text-left transition-colors hover:bg-primary-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => exportMap("text")}
            type="button"
          >
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <FileText className="size-4" />
            </span>
            <span>
              <span className="block text-sm font-medium text-foreground">
                Text summary
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                A readable outline for notes, slides, or quick sharing.
              </span>
            </span>
          </button>

          <Button onClick={copyTextSummary} type="button" variant="outline">
            <Clipboard className="size-4" />
            Copy text summary
          </Button>

          {exportFeedback ? (
            <p className="inline-flex items-center gap-2 rounded-md border border-[hsl(var(--success-border))] bg-[hsl(var(--success-soft))] px-3 py-2 text-sm text-[hsl(var(--success-foreground))]">
              <CheckCircle2 className="size-4" />
              {exportFeedback}
            </p>
          ) : null}
        </div>
      </ModalFrame>

      <ModalFrame
        description="Manage this workspace without leaving the map."
        onClose={closeDialog}
        open={activeDialog === "more"}
        title="Map actions"
      >
        <div className="space-y-3">
          <Button
            className="w-full justify-start"
            disabled={!canEditMapDetails}
            onClick={() => {
              setDetailsError(null)
              setActiveDialog("map-details")
            }}
            type="button"
            variant="outline"
          >
            <PencilLine className="size-4" />
            Edit details
          </Button>
          {!canEditMapDetails ? (
            <p className="text-xs text-muted-foreground">
              View-only access can inspect this map but cannot rename it.
            </p>
          ) : null}

          <Button
            className="w-full justify-start"
            disabled={!canDuplicateMap}
            onClick={() => {
              setDuplicateError(null)
              setActiveDialog("duplicate")
            }}
            type="button"
            variant="outline"
          >
            <Copy className="size-4" />
            Duplicate map
          </Button>
          {!canDuplicateMap ? (
            <p className="text-xs text-muted-foreground">
              Duplicate becomes available after the current map content loads.
            </p>
          ) : null}

          <Button
            className="w-full justify-start"
            onClick={() => {
              setShareFeedback(null)
              setShareMemberError(null)
              setActiveDialog("share")
            }}
            type="button"
            variant="outline"
          >
            <Link2 className="size-4" />
            Share invite details
          </Button>

          <Button
            className="w-full justify-start"
            onClick={() => {
              setExportFeedback(null)
              setActiveDialog("export")
            }}
            type="button"
            variant="outline"
          >
            <Download className="size-4" />
            Export map
          </Button>

          <Button
            className="w-full justify-start"
            disabled={!editor.canEdit || editor.nodes.length < 2}
            onClick={handleOrganizeMap}
            type="button"
            variant="outline"
          >
            <Network className="size-4" />
            Organize map
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              className="justify-start"
              disabled={!editor.canUndo}
              onClick={handleUndo}
              type="button"
              variant="outline"
            >
              <Undo2 className="size-4" />
              Undo
            </Button>
            <Button
              className="justify-start"
              disabled={!editor.canRedo}
              onClick={handleRedo}
              type="button"
              variant="outline"
            >
              <Redo2 className="size-4" />
              Redo
            </Button>
          </div>

          {canDeleteMap ? (
            <>
              <Separator />
              <Button
                className="w-full justify-start"
                onClick={() => {
                  setDeleteError(null)
                  setActiveDialog("delete")
                }}
                type="button"
                variant="destructive"
              >
                <Trash2 className="size-4" />
                Delete map
              </Button>
            </>
          ) : null}
        </div>
      </ModalFrame>

      {activeDialog === "map-details" ? (
        <MapDetailsModal
          description="Update the name and description shown to collaborators."
          errorMessage={detailsError}
          initialDescription={map.description}
          initialName={map.name}
          isSubmitting={updateMapDetailsMutation.isPending}
          onClose={closeDialog}
          onSubmit={handleUpdateMapDetails}
          open
          title="Edit map details"
        />
      ) : null}
      {activeDialog === "duplicate" ? (
        <MapDetailsModal
          description="Create a separate copy of this map. Nodes, layout, and connection details are copied; participants and sharing are not."
          errorMessage={duplicateError}
          initialDescription={map.description}
          initialName={`${map.name} (Copy)`}
          isSubmitting={duplicateMapMutation.isPending}
          onClose={closeDialog}
          onSubmit={handleDuplicateMap}
          open
          submittingLabel="Duplicating..."
          submitLabel="Create copy"
          title="Duplicate map"
        />
      ) : null}

      <ModalFrame
        description="This removes the map for everyone with access."
        onClose={closeDialog}
        open={activeDialog === "delete"}
        title="Delete map"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border/80 bg-card/95 px-3 py-3">
            <p className="text-sm font-medium text-foreground">{map.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Deleting a map removes its nodes, connections, and shared access.
            </p>
          </div>

          {deleteError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <Button onClick={closeDialog} type="button" variant="ghost">
              Cancel
            </Button>
            <Button
              disabled={deleteMapMutation.isPending}
              onClick={handleDeleteMap}
              type="button"
              variant="destructive"
            >
              <Trash2 className="size-4" />
              {deleteMapMutation.isPending ? "Deleting..." : "Delete map"}
            </Button>
          </div>
        </div>
      </ModalFrame>
    </section>
  )
}
