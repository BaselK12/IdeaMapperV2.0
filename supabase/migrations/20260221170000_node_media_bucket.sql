-- Create storage bucket for node media uploads if missing
insert into storage.buckets (id, name, public)
values ('node-media', 'node-media', true)
on conflict (id) do nothing;

-- Allow public read access to node media
create policy "node-media read"
on storage.objects
as permissive
for select
to public
using (bucket_id = 'node-media');

-- Allow authenticated users to upload
create policy "node-media insert"
on storage.objects
as permissive
for insert
to authenticated
with check (bucket_id = 'node-media');

-- Allow authenticated users to update
create policy "node-media update"
on storage.objects
as permissive
for update
to authenticated
using (bucket_id = 'node-media')
with check (bucket_id = 'node-media');

-- Allow authenticated users to delete
create policy "node-media delete"
on storage.objects
as permissive
for delete
to authenticated
using (bucket_id = 'node-media');
