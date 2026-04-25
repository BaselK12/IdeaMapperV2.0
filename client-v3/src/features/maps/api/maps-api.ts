import { supabase } from "@/lib/supabase"

import { saveMapEditorGraphById } from "@/features/map-editor/api/map-editor-api"
import {
  type AccessibleMap,
  type CreateMapPayload,
  type CreateSeededMapPayload,
  type JoinMapOutcome,
  type JoinMapPayload,
  JoinMapFlowError,
  type UpdatedMapDetails,
  type UpdateMapDetailsPayload,
} from "@/features/maps/types/maps-types"

type MapParticipantRow = {
  map: MapRecord | MapRecord[] | null
  role: string | null
}

type MapRecord = {
  description: string | null
  id: string
  last_edited: string | null
  name: string | null
  owner_id: string | null
}

type UpdatedMapDetailsRecord = {
  description: string | null
  id: string
  last_edited: string | null
  name: string | null
}

type ProfileRecord = {
  id: string
  username: string | null
}

export type MapHeader = {
  description: string
  id: string
  name: string
}

const invalidUuidMessage = "Please provide a valid map ID."

function isInvalidUuidError(error: { code?: string; message?: string } | null) {
  const message = (error?.message ?? "").toLowerCase()
  return error?.code === "22P02" || message.includes("invalid input syntax for type uuid")
}

function isMapLimitError(error: { code?: string; message?: string } | null) {
  return (error?.message ?? "").startsWith("map_limit_reached")
}

function normalizeMapWriteError(
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
    return "You do not have permission to manage this map."
  }

  if (isInvalidUuidError(error)) {
    return invalidUuidMessage
  }

  return error.message || fallback
}

function sortByLastEditedDesc(a: AccessibleMap, b: AccessibleMap) {
  const timeA = a.lastEdited ? Date.parse(a.lastEdited) : Number.NEGATIVE_INFINITY
  const timeB = b.lastEdited ? Date.parse(b.lastEdited) : Number.NEGATIVE_INFINITY
  return timeB - timeA
}

export async function fetchAccessibleMaps(userId: string): Promise<AccessibleMap[]> {
  const { data, error } = await supabase
    .from("map_participants")
    .select("role,map:maps(id,name,description,last_edited,owner_id)")
    .eq("user_id", userId)

  if (error) {
    throw new Error(error.message || "Failed to load your maps.")
  }

  const rows = (data ?? []) as MapParticipantRow[]

  const accessibleMaps: AccessibleMap[] = rows
    .map((row): AccessibleMap | null => {
      if (!row.map) {
        return null
      }

      const embeddedMap = Array.isArray(row.map) ? row.map[0] : row.map
      if (!embeddedMap) {
        return null
      }

      return {
        description: embeddedMap.description ?? "",
        id: embeddedMap.id,
        lastEdited: embeddedMap.last_edited,
        name: embeddedMap.name?.trim() || "Untitled",
        ownerName: null,
        ownerId: embeddedMap.owner_id,
        role: row.role ?? "viewer",
      } satisfies AccessibleMap
    })
    .filter((map): map is AccessibleMap => map !== null)

  const ownerIds = Array.from(
    new Set(
      accessibleMaps
        .map((map) => map.ownerId)
        .filter((ownerId): ownerId is string => Boolean(ownerId))
    )
  )
  const ownerNamesById = new Map<string, string>()

  if (ownerIds.length > 0) {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id,username")
      .in("id", ownerIds)

    if (!profileError) {
      for (const profile of (profileData ?? []) as ProfileRecord[]) {
        const normalizedName = profile.username?.trim()
        if (normalizedName) {
          ownerNamesById.set(profile.id, normalizedName)
        }
      }
    }
  }

  return accessibleMaps
    .map((map) => ({
      ...map,
      ownerName: map.ownerId ? ownerNamesById.get(map.ownerId) ?? null : null,
    }))
    .sort(sortByLastEditedDesc)
}

export async function createMap(payload: CreateMapPayload): Promise<string> {
  const { data, error } = await supabase.rpc("create_map", {
    p_description: payload.description?.trim() || "",
    p_name: payload.name.trim(),
  })

  if (error) {
    if (isMapLimitError(error)) {
      throw new Error("You have reached your map limit. Upgrade your plan to create more maps.")
    }
    throw new Error(error.message || "Failed to create map.")
  }

  if (typeof data !== "string" || data.length === 0) {
    throw new Error("Map creation succeeded but no map ID was returned.")
  }

  return data
}

export async function createMapWithSeed(
  payload: CreateSeededMapPayload
): Promise<string> {
  const nextMapId = await createMap({
    description: payload.description,
    name: payload.name,
  })

  try {
    await saveMapEditorGraphById(nextMapId, payload.nodes, payload.edges)
  } catch (error) {
    await supabase.from("maps").delete().eq("id", nextMapId)

    throw new Error(
      error instanceof Error
        ? `Map setup could not be completed. ${error.message}`
        : "Map setup could not be completed."
    )
  }

  return nextMapId
}

export async function updateMapDetails(
  payload: UpdateMapDetailsPayload
): Promise<UpdatedMapDetails> {
  const normalizedMapId = payload.mapId.trim()
  const normalizedName = payload.name.trim()

  if (!normalizedName) {
    throw new Error("Map name is required.")
  }

  const { data, error } = await supabase
    .from("maps")
    .update({
      description: payload.description?.trim() || "",
      last_edited: new Date().toISOString(),
      name: normalizedName,
    })
    .eq("id", normalizedMapId)
    .select("id,name,description,last_edited")
    .maybeSingle()

  if (error) {
    throw new Error(normalizeMapWriteError(error, "Failed to update map."))
  }

  if (!data) {
    throw new Error("Map details were not updated. Check your access and try again.")
  }

  const row = data as UpdatedMapDetailsRecord
  return {
    description: row.description ?? "",
    id: row.id,
    lastEdited: row.last_edited,
    name: row.name?.trim() || "Untitled",
  }
}

export async function deleteMapById(mapId: string) {
  const normalizedMapId = mapId.trim()

  const { data, error } = await supabase
    .from("maps")
    .delete()
    .eq("id", normalizedMapId)
    .select("id")
    .maybeSingle()

  if (error) {
    throw new Error(normalizeMapWriteError(error, "Failed to delete map."))
  }

  if (!data) {
    throw new Error("Only the owner can delete this map.")
  }
}

export async function leaveMapById(mapId: string, userId: string) {
  const { error } = await supabase
    .from("map_participants")
    .delete()
    .eq("map_id", mapId.trim())
    .eq("user_id", userId)

  if (error) {
    throw new Error(normalizeMapWriteError(error, "Failed to leave map."))
  }
}

export async function joinMapWithVerification(
  payload: JoinMapPayload
): Promise<JoinMapOutcome> {
  const mapId = payload.mapId.trim()
  const mapName = payload.mapName.trim()

  const { data: verificationResult, error: verifyError } = await supabase.rpc(
    "verify_map_name",
    {
      p_map_id: mapId,
      p_name: mapName,
    }
  )

  if (verifyError) {
    if (isInvalidUuidError(verifyError)) {
      throw new JoinMapFlowError("invalid-map-id", invalidUuidMessage)
    }

    throw new JoinMapFlowError(
      "backend",
      "Couldn't verify this map right now. Please try again."
    )
  }

  if (!verificationResult) {
    throw new JoinMapFlowError(
      "name-mismatch",
      "The map name does not match the provided ID."
    )
  }

  const { error: joinError } = await supabase.from("map_participants").insert({
    map_id: mapId,
    role: "viewer",
    user_id: payload.userId,
  })

  if (!joinError) {
    return "joined"
  }

  const message = (joinError.message ?? "").toLowerCase()
  if (joinError.code === "23505" || message.includes("duplicate")) {
    return "already-member"
  }

  if (isInvalidUuidError(joinError)) {
    throw new JoinMapFlowError("invalid-map-id", invalidUuidMessage)
  }

  throw new JoinMapFlowError(
    "backend",
    "Couldn't join this map. Ask the owner to verify the map details."
  )
}

export async function fetchMapHeaderById(mapId: string): Promise<MapHeader | null> {
  const { data, error } = await supabase
    .from("maps")
    .select("id,name,description")
    .eq("id", mapId)
    .maybeSingle()

  if (error) {
    if (isInvalidUuidError(error)) {
      return null
    }

    throw new Error(error.message || "Failed to load map.")
  }

  if (!data) {
    return null
  }

  return {
    description: data.description ?? "",
    id: data.id,
    name: data.name?.trim() || "Untitled",
  }
}
