import { supabase } from "@/lib/supabase"

import type {
  MapNodeComment,
  MapNodeCommentMention,
  MapNodeCommentThread,
  MapNodeCommentThreads,
} from "@/features/map-workspace/types/map-node-comments-types"

type MapNodeNotesRow = {
  id: string
  last_edited: string | null
  node_notes: unknown
}

type UpdatedMapNodeNotes = {
  lastEdited: string | null
  threads: MapNodeCommentThreads
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeIsoString(value: unknown) {
  const normalizedValue = normalizeOptionalString(value)
  return normalizedValue || null
}

function normalizeMention(value: unknown): MapNodeCommentMention | null {
  if (!isRecord(value)) {
    return null
  }

  const userId = normalizeOptionalString(value.userId)
  const displayName = normalizeOptionalString(value.displayName)
  if (!userId || !displayName) {
    return null
  }

  return {
    displayName,
    userId,
  }
}

function normalizeComment(value: unknown): MapNodeComment | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeOptionalString(value.id)
  const authorId = normalizeOptionalString(value.authorId)
  const authorName = normalizeOptionalString(value.authorName)
  const body = normalizeOptionalString(value.body)
  const createdAt = normalizeIsoString(value.createdAt)

  if (!id || !authorId || !authorName || !body || !createdAt) {
    return null
  }

  return {
    authorId,
    authorName,
    body,
    createdAt,
    id,
    mentions: Array.isArray(value.mentions)
      ? value.mentions
          .map(normalizeMention)
          .filter((mention): mention is MapNodeCommentMention => mention !== null)
      : [],
  }
}

function normalizeThread(value: unknown): MapNodeCommentThread | null {
  if (!isRecord(value)) {
    return null
  }

  const comments = Array.isArray(value.comments)
    ? value.comments
        .map(normalizeComment)
        .filter((comment): comment is MapNodeComment => comment !== null)
    : []

  if (comments.length === 0) {
    return null
  }

  return {
    comments,
    isResolved: value.isResolved === true,
    resolvedAt: normalizeIsoString(value.resolvedAt),
    resolvedById: normalizeIsoString(value.resolvedById),
    resolvedByName: normalizeIsoString(value.resolvedByName),
  }
}

function normalizeMapNodeCommentsError(
  error: { code?: string; message?: string } | null,
  fallback: string
) {
  if (!error) {
    return fallback
  }

  const message = error.message?.toLowerCase() ?? ""

  if (
    error.code === "42501" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("forbidden")
  ) {
    return "You do not have permission to change node comments on this map."
  }

  return error.message || fallback
}

export function normalizeMapNodeCommentThreads(
  rawThreads: unknown
): MapNodeCommentThreads {
  if (!isRecord(rawThreads)) {
    return {}
  }

  const normalizedThreads: MapNodeCommentThreads = {}

  for (const [nodeId, rawThread] of Object.entries(rawThreads)) {
    const normalizedNodeId = nodeId.trim()
    if (!normalizedNodeId) {
      continue
    }

    const normalizedThread = normalizeThread(rawThread)
    if (!normalizedThread) {
      continue
    }

    normalizedThreads[normalizedNodeId] = normalizedThread
  }

  return normalizedThreads
}

export async function fetchMapNodeCommentThreads(
  mapId: string
): Promise<MapNodeCommentThreads> {
  const normalizedMapId = mapId.trim()

  const { data, error } = await supabase
    .from("maps")
    .select("id,node_notes")
    .eq("id", normalizedMapId)
    .maybeSingle()

  if (error) {
    throw new Error(
      normalizeMapNodeCommentsError(error, "Failed to load node comments.")
    )
  }

  if (!data) {
    return {}
  }

  return normalizeMapNodeCommentThreads((data as MapNodeNotesRow).node_notes)
}

export async function updateMapNodeCommentThreads(params: {
  mapId: string
  threads: MapNodeCommentThreads
}): Promise<UpdatedMapNodeNotes> {
  const normalizedMapId = params.mapId.trim()
  const nextLastEdited = new Date().toISOString()

  const { data, error } = await supabase
    .from("maps")
    .update({
      last_edited: nextLastEdited,
      node_notes: params.threads,
    })
    .eq("id", normalizedMapId)
    .select("id,node_notes,last_edited")
    .maybeSingle()

  if (error) {
    throw new Error(
      normalizeMapNodeCommentsError(error, "Failed to update node comments.")
    )
  }

  if (!data) {
    throw new Error("Node comments were not updated. Check your access and try again.")
  }

  const row = data as MapNodeNotesRow
  return {
    lastEdited: row.last_edited,
    threads: normalizeMapNodeCommentThreads(row.node_notes),
  }
}
