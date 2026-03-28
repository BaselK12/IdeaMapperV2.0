-- Enforce map creation limits inside the create_map RPC.
-- DB-side enforcement is the authoritative guard: it cannot be bypassed
-- by UI changes or direct Supabase client calls from the browser.
CREATE OR REPLACE FUNCTION public.create_map(
  p_name text,
  p_description text DEFAULT ''::text
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_map_id    uuid;
  v_map_limit integer;
  v_map_count integer;
BEGIN
  -- Read the caller's allowed map limit from their profile.
  -- COALESCE on the column handles a NULL map_limit value.
  -- The second COALESCE assignment handles a missing profile row:
  -- PostgreSQL sets the INTO variable to NULL when no row is found,
  -- so the column-level COALESCE alone is not sufficient.
  SELECT COALESCE(map_limit, 5)
  INTO v_map_limit
  FROM public.profiles
  WHERE id = auth.uid();

  v_map_limit := COALESCE(v_map_limit, 5);

  -- Count maps currently owned by this user.
  SELECT COUNT(*)
  INTO v_map_count
  FROM public.maps
  WHERE owner_id = auth.uid();

  IF v_map_count >= v_map_limit THEN
    RAISE EXCEPTION 'map_limit_reached: You have reached your map limit of %. Upgrade your plan to create more maps.', v_map_limit
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.maps (name, description, owner_id)
  VALUES (p_name, COALESCE(p_description, ''), auth.uid())
  RETURNING id INTO v_map_id;

  INSERT INTO public.map_participants (map_id, user_id, role)
  VALUES (v_map_id, auth.uid(), 'admin')
  ON CONFLICT (map_id, user_id) DO NOTHING;

  RETURN v_map_id;
END;
$$;
