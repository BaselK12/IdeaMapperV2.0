import { supabase } from "@/lib/supabase"

export type MapParticipantRoleRow = {
  role: string | null
  user_id: string
}

export type MapParticipantProfileRow = {
  id: string
  profile_picture: string | null
  username: string | null
}

export type MapPresenceRow = {
  online: boolean | null
  user_id: string
}

type UpsertMapPresenceHeartbeatParams = {
  color: string
  mapId: string
  userId: string
  username: string
}

type ManageMapParticipantParams = {
  mapId: string
  userId: string
}

type UpdateMapParticipantRoleParams = ManageMapParticipantParams & {
  role: "admin" | "editor" | "viewer"
}

function normalizeMapParticipantMutationError(
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
    return "You do not have permission to manage members on this map."
  }

  return error.message || fallback
}

export async function fetchMapParticipantRoleRows(mapId: string) {
  const { data, error } = await supabase
    .from("map_participants")
    .select("user_id,role")
    .eq("map_id", mapId)

  if (error) {
    throw new Error(error.message || "Failed to load map participants.")
  }

  return (data ?? []) as MapParticipantRoleRow[]
}

export async function fetchMapParticipantProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return [] as MapParticipantProfileRow[]
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,username,profile_picture")
    .in("id", userIds)

  if (error) {
    throw new Error(error.message || "Failed to load participant profiles.")
  }

  return (data ?? []) as MapParticipantProfileRow[]
}

export async function fetchMapPresenceRows(mapId: string) {
  const { data, error } = await supabase
    .from("map_presence")
    .select("user_id,online")
    .eq("map_id", mapId)

  if (error) {
    throw new Error(error.message || "Failed to load participant presence.")
  }

  return (data ?? []) as MapPresenceRow[]
}

export async function upsertMapPresenceHeartbeat({
  color,
  mapId,
  userId,
  username,
}: UpsertMapPresenceHeartbeatParams) {
  const { error } = await supabase.from("map_cursors").upsert({
    color,
    map_id: mapId,
    updated_at: new Date().toISOString(),
    user_id: userId,
    username,
    x: 0,
    y: 0,
  })

  if (error) {
    throw new Error(error.message || "Failed to update map presence heartbeat.")
  }
}

export async function updateMapParticipantRole({
  mapId,
  role,
  userId,
}: UpdateMapParticipantRoleParams) {
  const { data, error } = await supabase
    .from("map_participants")
    .update({ role })
    .eq("map_id", mapId)
    .eq("user_id", userId)
    .select("user_id,role")
    .maybeSingle()

  if (error) {
    throw new Error(
      normalizeMapParticipantMutationError(error, "Failed to update member role.")
    )
  }

  if (!data) {
    throw new Error("Member role was not updated. Check your access and try again.")
  }
}

export async function removeMapParticipant({
  mapId,
  userId,
}: ManageMapParticipantParams) {
  const { data, error } = await supabase
    .from("map_participants")
    .delete()
    .eq("map_id", mapId)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle()

  if (error) {
    throw new Error(
      normalizeMapParticipantMutationError(error, "Failed to remove member.")
    )
  }

  if (!data) {
    throw new Error("Member was not removed. Check your access and try again.")
  }
}
