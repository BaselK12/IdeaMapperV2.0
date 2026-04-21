/**
 * Playwright globalSetup — runs once before all tests.
 *
 * Responsibilities:
 *  1. Sign in as the E2E admin and find (or create) the shared "E2E Viewer
 *     Test Map" that the viewer read-only test needs to exist.
 *  2. Sign in as the E2E viewer and ensure they are a participant on that
 *     map with the "viewer" role.
 *  3. Write the resolved map ID to e2e/.test-state.json so tests can read it.
 *
 * Why here and not in the test itself?
 *  - globalSetup runs before any browser workers are started, so state is
 *    guaranteed to be ready before the first test opens a page.
 *  - It uses the Supabase JS client directly (no browser needed), which is
 *    faster and more reliable than driving the UI for setup.
 */
import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, "../../.env.local") })

const STATE_FILE = path.resolve(__dirname, "../.test-state.json")
const VIEWER_MAP_NAME = "E2E Viewer Test Map"
const PERSIST_MAP_NAME = "E2E Persistence Test Map"

type ParticipantMap = { id: string; name: string }
type ParticipantRow = { map: ParticipantMap | ParticipantMap[] | null }

function getParticipantMap(row: ParticipantRow) {
  if (Array.isArray(row.map)) {
    return row.map[0] ?? null
  }

  return row.map
}

function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value) {
    throw new Error(
      `Missing required env var: ${key}\n` +
        `Add it to client-v3/.env.local (see e2e/.env.test.example).`
    )
  }
  return value
}

export default async function globalSetup(): Promise<void> {
  const supabaseUrl = requireEnv("VITE_SUPABASE_URL")
  const supabaseAnonKey = requireEnv("VITE_SUPABASE_ANON_KEY")
  const adminEmail = requireEnv("E2E_ADMIN_EMAIL")
  const adminPassword = requireEnv("E2E_ADMIN_PASSWORD")
  const viewerEmail = requireEnv("E2E_VIEWER_EMAIL")
  const viewerPassword = requireEnv("E2E_VIEWER_PASSWORD")

  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // ── Step 1: Admin signs in ──────────────────────────────────────────────
  const { data: adminAuth, error: adminSignInError } =
    await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    })

  if (adminSignInError || !adminAuth.user) {
    throw new Error(`Admin sign-in failed: ${adminSignInError?.message}`)
  }

  // ── Step 1b: Delete stale one-off test maps from old test runs ───────────
  // Previous test design created a new "E2E Persist <timestamp>" map every run.
  // Delete any still present so they don't consume map-limit quota.
  const { error: cleanupError } = await supabase
    .from("maps")
    .delete()
    .eq("owner_id", adminAuth.user.id)
    .like("name", "E2E Persist%")

  if (cleanupError) {
    console.warn(`[globalSetup] Cleanup warning: ${cleanupError.message}`)
  }

  // ── Step 1c: Find or create the persistence test map ────────────────────
  // The persistence test navigates directly to this map (same pattern as the
  // viewer test) to avoid the SPA create→redirect flow which was leaving the
  // graphQuery in a never-resolving state.  The graph is reset to empty here
  // so the test always starts from a known 0-node state.
  // Re-fetch participant rows AFTER cleanup so we see the post-delete state.
  const { data: adminRows } = await supabase
    .from("map_participants")
    .select("map:maps(id,name)")
    .eq("user_id", adminAuth.user.id)

  const adminParticipantRows = (adminRows ?? []) as unknown as ParticipantRow[]
  let persistTestMapId: string | null = null
  for (const row of adminParticipantRows) {
    const map = getParticipantMap(row)
    if (map?.name === PERSIST_MAP_NAME) {
      persistTestMapId = map.id
      break
    }
  }

  if (!persistTestMapId) {
    const { data: newPersistId, error: persistCreateError } = await supabase.rpc(
      "create_map",
      {
        p_name: PERSIST_MAP_NAME,
        p_description: "Map used by E2E persistence test. Graph is reset each run.",
      }
    )
    if (persistCreateError || !newPersistId) {
      throw new Error(
        `Failed to create persistence test map: ${persistCreateError?.message}`
      )
    }
    persistTestMapId = newPersistId as string
  } else {
    // Reset graph to empty so the test always starts with 0 nodes
    const { error: resetError } = await supabase
      .from("maps")
      .update({ nodes: null, edges: null })
      .eq("id", persistTestMapId)
      .eq("owner_id", adminAuth.user.id)

    if (resetError) {
      console.warn(`[globalSetup] Graph reset warning: ${resetError.message}`)
    }
  }

  // ── Step 2: Find or create the viewer test map ──────────────────────────
  // Re-use the rows already fetched above
  let viewerTestMapId: string | null = null
  for (const row of adminParticipantRows) {
    const map = getParticipantMap(row)
    if (map?.name === VIEWER_MAP_NAME) {
      viewerTestMapId = map.id
      break
    }
  }

  if (!viewerTestMapId) {
    const { data: newMapId, error: createError } = await supabase.rpc(
      "create_map",
      {
        p_name: VIEWER_MAP_NAME,
        p_description: "Shared map used by the E2E viewer read-only test.",
      }
    )
    if (createError || !newMapId) {
      throw new Error(
        `Failed to create viewer test map: ${createError?.message}`
      )
    }
    viewerTestMapId = newMapId as string
  }

  await supabase.auth.signOut()

  // ── Step 3: Viewer signs in and self-joins the map ──────────────────────
  const { data: viewerAuth, error: viewerSignInError } =
    await supabase.auth.signInWithPassword({
      email: viewerEmail,
      password: viewerPassword,
    })

  if (viewerSignInError || !viewerAuth.user) {
    throw new Error(`Viewer sign-in failed: ${viewerSignInError?.message}`)
  }

  // Check existing membership before inserting (the mp_select RLS policy
  // returns rows only when the caller IS already a member, so an empty result
  // reliably means "not yet a participant").
  const { data: membership } = await supabase
    .from("map_participants")
    .select("role")
    .eq("map_id", viewerTestMapId)
    .eq("user_id", viewerAuth.user.id)
    .maybeSingle()

  if (!membership) {
    const { error: joinError } = await supabase
      .from("map_participants")
      .insert({
        map_id: viewerTestMapId,
        role: "viewer",
        user_id: viewerAuth.user.id,
      })
    if (joinError) {
      throw new Error(
        `Failed to add viewer to test map: ${joinError.message}`
      )
    }
  }

  await supabase.auth.signOut()

  // ── Step 4: Persist state for tests ────────────────────────────────────
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({ persistTestMapId, viewerTestMapId }),
    "utf-8"
  )

  console.log(`[globalSetup] Viewer test map ready: ${viewerTestMapId}`)
  console.log(`[globalSetup] Persistence test map ready: ${persistTestMapId}`)
}
