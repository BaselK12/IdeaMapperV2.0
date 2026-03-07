import { supabase } from "@/lib/supabase"

import {
  MapWorkspaceLoadError,
  type MapWorkspace,
} from "@/features/map-workspace/types/map-workspace-types"

type MapRow = {
  description: string | null
  id: string
  last_edited: string | null
  name: string | null
  owner_id: string | null
}

type ParticipantMapRow = {
  map: MapRow | MapRow[] | null
  role: string | null
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidMapId(mapId: string) {
  return uuidPattern.test(mapId.trim())
}

function isInvalidUuidError(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase()
  return error?.code === "22P02" || message.includes("invalid input syntax for type uuid")
}

function isPermissionError(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase()
  return (
    error?.code === "42501" ||
    message.includes("permission") ||
    message.includes("not allowed") ||
    message.includes("forbidden")
  )
}

export async function fetchMapWorkspaceById(
  mapId: string,
  userId: string
): Promise<MapWorkspace> {
  const normalizedMapId = mapId.trim()

  if (!isValidMapId(normalizedMapId)) {
    throw new MapWorkspaceLoadError("not-found", "This map link is invalid.")
  }

  const { data, error } = await supabase
    .from("map_participants")
    .select("role,map:maps(id,name,description,last_edited,owner_id)")
    .eq("map_id", normalizedMapId)
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    if (isInvalidUuidError(error)) {
      throw new MapWorkspaceLoadError("not-found", "This map link is invalid.")
    }

    if (isPermissionError(error)) {
      throw new MapWorkspaceLoadError(
        "no-access",
        "You do not have permission to open this map."
      )
    }

    throw new MapWorkspaceLoadError(
      "unknown",
      error.message || "Failed to load this map."
    )
  }

  const participantRow = (data ?? null) as ParticipantMapRow | null
  if (!participantRow?.map) {
    throw new MapWorkspaceLoadError(
      "no-access",
      "This map is not available for your account."
    )
  }

  const rawMap = Array.isArray(participantRow.map)
    ? participantRow.map[0]
    : participantRow.map

  if (!rawMap) {
    throw new MapWorkspaceLoadError(
      "no-access",
      "This map is not available for your account."
    )
  }

  return {
    description: rawMap.description ?? "",
    id: rawMap.id,
    lastEdited: rawMap.last_edited,
    name: rawMap.name?.trim() || "Untitled",
    ownerId: rawMap.owner_id,
    role: participantRow.role ?? "viewer",
  }
}
