import { supabase } from "@/lib/supabase"

import {
  type AccessibleMap,
  type CreateMapPayload,
  type JoinMapOutcome,
  type JoinMapPayload,
  JoinMapFlowError,
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

  return rows
    .map((row) => {
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
        ownerId: embeddedMap.owner_id,
        role: row.role ?? "viewer",
      } satisfies AccessibleMap
    })
    .filter((map): map is AccessibleMap => Boolean(map))
    .sort(sortByLastEditedDesc)
}

export async function createMap(payload: CreateMapPayload): Promise<string> {
  const { data, error } = await supabase.rpc("create_map", {
    p_description: payload.description?.trim() || "",
    p_name: payload.name.trim(),
  })

  if (error) {
    throw new Error(error.message || "Failed to create map.")
  }

  if (typeof data !== "string" || data.length === 0) {
    throw new Error("Map creation succeeded but no map ID was returned.")
  }

  return data
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
