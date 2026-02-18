DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'map_participants_pkey'
      AND conrelid = 'public.map_participants'::regclass
  ) THEN
    ALTER TABLE public.map_participants
      ADD CONSTRAINT map_participants_pkey PRIMARY KEY (map_id, user_id);
  END IF;
END $$;

UPDATE public.map_participants
SET role = 'admin'
WHERE role = 'owner';

UPDATE public.map_participants
SET role = 'member'
WHERE role = 'editor';

INSERT INTO public.map_participants (map_id, user_id, role)
SELECT id, owner_id, 'admin'
FROM public.maps
WHERE owner_id IS NOT NULL
ON CONFLICT (map_id, user_id) DO NOTHING;

ALTER TABLE public.map_participants
  ALTER COLUMN role SET DEFAULT 'member';

CREATE OR REPLACE FUNCTION public.create_map(p_name text, p_description text DEFAULT ''::text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_map_id uuid;
begin
  insert into public.maps (name, description, owner_id)
  values (p_name, coalesce(p_description, ''), auth.uid())
  returning id into v_map_id;

  insert into public.map_participants (map_id, user_id, role)
  values (v_map_id, auth.uid(), 'admin')
  on conflict (map_id, user_id) do nothing;

  return v_map_id;
end;
$$;

CREATE OR REPLACE FUNCTION public.ensure_owner_participant() RETURNS trigger
LANGUAGE plpgsql
AS $$
begin
  insert into public.map_participants (map_id, user_id, role)
  values (new.id, new.owner_id, 'admin')
  on conflict (map_id, user_id) do nothing;
  return new;
end
$$;
