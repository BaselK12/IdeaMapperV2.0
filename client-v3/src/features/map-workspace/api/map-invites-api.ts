import { supabase } from "@/lib/supabase"

import type {
  AcceptInviteResult,
  MapInvite,
  MapInvitePreview,
  MapInviteRole,
} from "@/features/map-workspace/types/map-invites-types"

function normalizeRole(value: unknown): MapInviteRole {
  return value === "editor" ? "editor" : "viewer"
}

function normalizeOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeInviteRow(row: Record<string, unknown>): MapInvite {
  return {
    acceptedAt: typeof row.accepted_at === "string" ? row.accepted_at : null,
    createdAt: normalizeOptionalString(row.created_at) || new Date().toISOString(),
    expiresAt: normalizeOptionalString(row.expires_at) || new Date().toISOString(),
    id: normalizeOptionalString(row.id),
    inviteeEmail: normalizeOptionalString(row.invitee_email),
    mapId: normalizeOptionalString(row.map_id),
    role: normalizeRole(row.role),
    token: normalizeOptionalString(row.token),
  }
}

export async function createMapInvite(params: {
  inviteeEmail: string
  mapId: string
  role: MapInviteRole
}): Promise<MapInvite> {
  const { data, error } = await supabase
    .from("map_invites")
    .insert({
      invitee_email: params.inviteeEmail.trim().toLowerCase(),
      map_id: params.mapId,
      role: params.role,
    })
    .select("id,map_id,invitee_email,role,token,invited_by,created_at,accepted_at,expires_at")
    .maybeSingle()

  if (error) {
    throw new Error(error.message || "Failed to create invite.")
  }
  if (!data) {
    throw new Error("Invite was not created.")
  }
  return normalizeInviteRow(data as Record<string, unknown>)
}

export async function loadMapInvites(mapId: string): Promise<MapInvite[]> {
  const { data, error } = await supabase
    .from("map_invites")
    .select("id,map_id,invitee_email,role,token,invited_by,created_at,accepted_at,expires_at")
    .eq("map_id", mapId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message || "Failed to load invites.")
  }
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeInviteRow)
}

export async function revokeMapInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.from("map_invites").delete().eq("id", inviteId)
  if (error) {
    throw new Error(error.message || "Failed to revoke invite.")
  }
}

export async function getMapInviteByToken(
  token: string
): Promise<MapInvitePreview | null> {
  const { data, error } = await supabase.rpc("get_map_invite_by_token", {
    p_token: token,
  })

  if (error || !data) return null

  type RpcRow = {
    invite_id: string
    map_id: string
    map_name: string
    invitee_email: string
    role: string
    invited_by_id: string
    invited_by_name: string
    created_at: string
    expires_at: string
  }

  const rows = data as RpcRow[]
  if (!rows || rows.length === 0) return null
  const row = rows[0]

  return {
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    inviteId: row.invite_id,
    invitedById: row.invited_by_id,
    invitedByName: row.invited_by_name,
    inviteeEmail: row.invitee_email,
    mapId: row.map_id,
    mapName: row.map_name,
    role: normalizeRole(row.role),
  }
}

export async function acceptMapInvite(token: string): Promise<AcceptInviteResult> {
  const { data, error } = await supabase.rpc("accept_map_invite", {
    p_token: token,
  })

  if (error) {
    return { error: "unknown", success: false }
  }

  const result = data as {
    error?: string
    invited_by?: string
    map_id?: string
    map_name?: string
    role?: string
  }

  if (result.error) {
    const code = result.error
    if (code === "not_authenticated") return { error: "not_authenticated", success: false }
    if (code === "email_mismatch") return { error: "email_mismatch", success: false }
    if (code === "invite_not_found") return { error: "not_found", success: false }
    return { error: "unknown", success: false }
  }

  if (!result.map_id || !result.map_name) {
    return { error: "unknown", success: false }
  }

  return {
    mapId: result.map_id,
    mapName: result.map_name,
    role: normalizeRole(result.role),
    success: true,
  }
}
