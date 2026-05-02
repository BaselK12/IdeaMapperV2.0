-- =============================================
-- Collaboration Infrastructure Migration
-- Date: 2026-05-02
-- Applies: Supabase SQL Editor or `supabase db push`
-- =============================================


-- =============================================
-- PART A: Direct Invites
-- =============================================

CREATE TABLE IF NOT EXISTS map_invites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id        UUID        NOT NULL REFERENCES maps(id) ON DELETE CASCADE,
  invitee_email TEXT        NOT NULL,
  role          TEXT        NOT NULL DEFAULT 'viewer'
                              CONSTRAINT map_invites_role_check
                              CHECK (role IN ('viewer', 'editor')),
  token         UUID        NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS map_invites_map_id_idx ON map_invites(map_id);
CREATE INDEX IF NOT EXISTS map_invites_token_idx   ON map_invites(token);

ALTER TABLE map_invites ENABLE ROW LEVEL SECURITY;

-- Map admins/owners can read and manage invites for their maps.
-- The USING clause also allows the original inviter to read their own invites.
CREATE POLICY "map admins manage invites"
  ON map_invites FOR ALL TO authenticated
  USING (
    invited_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM maps m
      WHERE m.id = map_invites.map_id AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM map_participants mp
      WHERE mp.map_id = map_invites.map_id
        AND mp.user_id = auth.uid()
        AND mp.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maps m
      WHERE m.id = map_invites.map_id AND m.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM map_participants mp
      WHERE mp.map_id = map_invites.map_id
        AND mp.user_id = auth.uid()
        AND mp.role = 'admin'
    )
  );

-- Returns invite preview only if:
--   - The token exists
--   - The invite is pending (not accepted, not expired)
--   - The current user's email matches invitee_email (case-insensitive)
-- This prevents invite enumeration while allowing the invite page to show details.
CREATE OR REPLACE FUNCTION get_map_invite_by_token(p_token UUID)
RETURNS TABLE (
  invite_id       UUID,
  map_id          UUID,
  map_name        TEXT,
  invitee_email   TEXT,
  role            TEXT,
  invited_by_id   UUID,
  invited_by_name TEXT,
  created_at      TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  RETURN QUERY
    SELECT
      mi.id                                                        AS invite_id,
      mi.map_id,
      COALESCE(m.name, 'Untitled')::TEXT                          AS map_name,
      mi.invitee_email,
      mi.role,
      mi.invited_by                                               AS invited_by_id,
      COALESCE(p.username, au.email, 'A teammate')::TEXT          AS invited_by_name,
      mi.created_at,
      mi.expires_at
    FROM  map_invites mi
    JOIN  maps m         ON m.id  = mi.map_id
    JOIN  auth.users au  ON au.id = mi.invited_by
    LEFT JOIN profiles p ON p.id  = mi.invited_by
    WHERE mi.token = p_token
      AND LOWER(mi.invitee_email) = LOWER(v_user_email)
      AND mi.accepted_at IS NULL
      AND mi.expires_at  > NOW();
END;
$$;

-- Atomically accepts an invite:
--   1. Verifies token is valid, pending, not expired
--   2. Verifies current user's email matches invitee_email
--   3. Inserts into map_participants (idempotent on duplicate)
--   4. Marks invite as accepted
-- Returns JSONB: { map_id, map_name, role, invited_by } on success
--                { error: <code> } on failure
CREATE OR REPLACE FUNCTION accept_map_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_user_email TEXT;
  v_invite     map_invites%ROWTYPE;
  v_map_name   TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'not_authenticated');
  END IF;

  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM map_invites
  WHERE token       = p_token
    AND accepted_at IS NULL
    AND expires_at  > NOW();

  IF v_invite.id IS NULL THEN
    RETURN jsonb_build_object('error', 'invite_not_found');
  END IF;

  IF LOWER(v_invite.invitee_email) != LOWER(v_user_email) THEN
    RETURN jsonb_build_object('error', 'email_mismatch');
  END IF;

  INSERT INTO map_participants (map_id, user_id, role)
  VALUES (v_invite.map_id, v_user_id, v_invite.role)
  ON CONFLICT (map_id, user_id) DO NOTHING;

  UPDATE map_invites
  SET accepted_at = NOW()
  WHERE id = v_invite.id;

  SELECT name INTO v_map_name FROM maps WHERE id = v_invite.map_id;

  RETURN jsonb_build_object(
    'map_id',     v_invite.map_id::TEXT,
    'map_name',   COALESCE(v_map_name, 'Untitled'),
    'role',       v_invite.role,
    'invited_by', v_invite.invited_by::TEXT
  );
END;
$$;


-- =============================================
-- PART B: Notifications
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL,
  data       JSONB       NOT NULL DEFAULT '{}',
  map_id     UUID        REFERENCES maps(id) ON DELETE CASCADE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "users update own notifications"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users delete own notifications"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- SECURITY DEFINER: safe cross-user notification creation.
-- Validates: caller is authenticated, type is known, skips self-notifications.
-- Used by frontend after comment saves (mentions) and role changes.
-- No INSERT RLS policy is needed; all inserts go through this function.
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_data    JSONB,
  p_map_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Skip self-notifications
  IF p_user_id = auth.uid() THEN
    RETURN NULL;
  END IF;

  -- Only allow known notification types
  IF p_type NOT IN ('mention', 'role_changed', 'map_invite_accepted') THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (user_id, type, data, map_id)
  VALUES (p_user_id, p_type, p_data, p_map_id)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
