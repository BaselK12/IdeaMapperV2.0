-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 3 — Security hardening
-- Applied: 2026-04-18
--
-- Changes (all additive / revocative — no schema structure changed):
--
--   A. Revoke anon EXECUTE on SECURITY DEFINER functions that bypass RLS
--      and expose map/participant data to unauthenticated callers.
--
--   B. Tighten node-media storage update/delete to file owner only.
--      Previously any authenticated user could overwrite or delete any
--      other user's uploaded node media.
--
--   C. Drop mc_update_self on map_cursors — it has no participation check
--      in its WITH CHECK, which undermines the stricter cursors_update_self
--      policy (PostgreSQL ORs permissive policies; the weaker one wins).
--
--   D. Drop exact-duplicate policies on map_cursors (mc_insert_self,
--      mc_select_same_map) that duplicate cursors_insert_self /
--      cursors_select_participants.
--
--   E. Drop duplicate / subsumed SELECT and UPDATE policies on profiles
--      (profiles_select_all, profiles_select_self, profiles_update_own).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── A. Function grants ────────────────────────────────────────────────────────

-- verify_map_name: SECURITY DEFINER — bypasses maps RLS and confirms whether
-- a (map_id, name) pair is correct. Unauthenticated callers had no legitimate
-- use for this; the join-map flow only fires for authenticated users.
REVOKE EXECUTE ON FUNCTION public.verify_map_name(uuid, text) FROM anon;

-- create_map: SECURITY DEFINER — auth.uid() is NULL for anon so the INSERT
-- always fails, but the grant is misleading and should be explicit.
REVOKE EXECUTE ON FUNCTION public.create_map(text, text) FROM anon;

-- is_participant, is_map_editor, is_map_admin: SECURITY DEFINER helpers used
-- inside RLS USING clauses. Their internal queries bypass RLS, so an anon
-- caller can probe whether specific (map, user) pairs exist in the DB.
-- RLS policy evaluation is unaffected — the DB engine calls these as the
-- definer (postgres), not as the anon role.
REVOKE EXECUTE ON FUNCTION public.is_participant(uuid, uuid)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_map_editor(uuid, uuid)    FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_map_admin(uuid, uuid)     FROM anon;


-- ── B. node-media storage policies ───────────────────────────────────────────

-- Drop the overly-broad update/delete policies (any authenticated user could
-- modify or delete any other user's files).
DROP POLICY IF EXISTS "node-media update" ON storage.objects;
DROP POLICY IF EXISTS "node-media delete" ON storage.objects;

-- Replace with owner-only variants.
-- storage.objects.owner is automatically set to auth.uid() on upload by
-- Supabase Storage; it is never NULL for authenticated uploads.
CREATE POLICY "node-media update own"
  ON storage.objects
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING  (bucket_id = 'node-media' AND owner = auth.uid())
  WITH CHECK (bucket_id = 'node-media' AND owner = auth.uid());

CREATE POLICY "node-media delete own"
  ON storage.objects
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'node-media' AND owner = auth.uid());


-- ── C. map_cursors: drop the weaker UPDATE policy ────────────────────────────

-- mc_update_self WITH CHECK only checks user_id = auth.uid() — no
-- participation requirement. cursors_update_self WITH CHECK adds the
-- participation check. Because PostgreSQL ORs permissive policies,
-- mc_update_self's weaker WITH CHECK was the effective one.
-- After this drop, cursors_update_self is the sole UPDATE policy and its
-- participation check is enforced correctly.
DROP POLICY IF EXISTS "mc_update_self" ON public.map_cursors;


-- ── D. map_cursors: drop exact-duplicate INSERT and SELECT policies ────────────

-- mc_insert_self is byte-for-byte identical to cursors_insert_self.
DROP POLICY IF EXISTS "mc_insert_self" ON public.map_cursors;

-- mc_select_same_map is byte-for-byte identical to cursors_select_participants.
DROP POLICY IF EXISTS "mc_select_same_map" ON public.map_cursors;


-- ── E. profiles: drop duplicate / subsumed SELECT and UPDATE policies ─────────

-- profiles_select_all: identical to profiles_read (both USING true).
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;

-- profiles_select_self: USING (id = auth.uid()) is fully subsumed by
-- profiles_read (USING true). Keeping it creates a false impression that
-- profile reads are restricted, while profiles_read grants full access.
DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;

-- profiles_update_own: USING (auth.uid() = id) with no WITH CHECK — PostgreSQL
-- defaults WITH CHECK to the USING expression, making it identical to
-- profiles_update_self which has an explicit WITH CHECK (id = auth.uid()).
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
