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
