-- Normalize existing roles
update public.map_participants
set role = 'admin'
where role = 'owner';

update public.map_participants
set role = 'editor'
where role = 'member';

update public.map_participants
set role = 'viewer'
where role is null
   or role not in ('viewer', 'editor', 'admin');

-- Default new members to viewer
alter table public.map_participants
  alter column role set default 'viewer';

-- Enforce valid roles
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'map_participants_role_check'
      and conrelid = 'public.map_participants'::regclass
  ) then
    alter table public.map_participants
      add constraint map_participants_role_check
      check (role in ('viewer', 'editor', 'admin'));
  end if;
end $$;

-- Helper functions for RLS
create or replace function public.is_map_editor(p_map uuid, p_user uuid)
returns boolean
language sql security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.maps m
    left join public.map_participants mp
      on mp.map_id = m.id and mp.user_id = p_user
    where m.id = p_map
      and (m.owner_id = p_user or mp.role in ('editor', 'admin'))
  );
$$;

create or replace function public.is_map_admin(p_map uuid, p_user uuid)
returns boolean
language sql security definer
set search_path = 'public'
as $$
  select exists (
    select 1
    from public.maps m
    left join public.map_participants mp
      on mp.map_id = m.id and mp.user_id = p_user
    where m.id = p_map
      and (m.owner_id = p_user or mp.role = 'admin')
  );
$$;

-- RLS policy updates

drop policy if exists "maps_update_participants" on public.maps;
create policy "maps_update_participants"
  on public.maps
  for update
  to authenticated
  using (public.is_map_editor(id, auth.uid()))
  with check (public.is_map_editor(id, auth.uid()));

-- map_participants: join as viewer only

drop policy if exists "mp_insert_self" on public.map_participants;
create policy "mp_insert_self"
  on public.map_participants
  for insert
  to authenticated
  with check (user_id = auth.uid() and role = 'viewer');

-- map_participants: admin-only role changes

drop policy if exists "mp_update_self" on public.map_participants;
drop policy if exists "mp_update_admin" on public.map_participants;
create policy "mp_update_admin"
  on public.map_participants
  for update
  to authenticated
  using (public.is_map_admin(map_id, auth.uid()))
  with check (public.is_map_admin(map_id, auth.uid()));

-- map_participants: allow self-leave + admin removal

drop policy if exists "mp_delete_self" on public.map_participants;
create policy "mp_delete_self"
  on public.map_participants
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "mp_delete_admin" on public.map_participants;
create policy "mp_delete_admin"
  on public.map_participants
  for delete
  to authenticated
  using (public.is_map_admin(map_id, auth.uid()));
