-- BizGuard targeted repair: payment receipt storage bucket.
-- LOCKED TARGET:
-- Fix "Bucket not found" when a user has completed a bank transfer,
-- selected the receipt, and presses Continue.
--
-- Additive only. Do not change payment plans, approval logic, subscriptions,
-- Admin Portal behavior, AI, Snap Count, or unrelated application logic.

-- The existing payment flow uploads receipts to this private bucket:
--   bizguard-captures
-- Some production environments may have the application policies/migrations
-- recorded while the actual Storage bucket was missing or removed.
-- Recreate/repair the bucket idempotently so an existing customer does not
-- have to pay again.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'bizguard-captures',
  'bizguard-captures',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Preserve the existing private per-user receipt model.
-- Users may upload only inside their own UUID folder.
drop policy if exists bizguard_captures_insert on storage.objects;
create policy bizguard_captures_insert
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'bizguard-captures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Users retain access to their own receipt objects.
drop policy if exists bizguard_captures_select on storage.objects;
create policy bizguard_captures_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'bizguard-captures'
  and owner_id = auth.uid()
);

-- Users may remove their own uploaded receipt object.
drop policy if exists bizguard_captures_delete on storage.objects;
create policy bizguard_captures_delete
on storage.objects
for delete to authenticated
using (
  bucket_id = 'bizguard-captures'
  and owner_id = auth.uid()
);

-- Super Admins retain the existing ability to inspect private payment proofs
-- through the existing Admin Portal flow.
drop policy if exists bizguard_captures_admin_select on storage.objects;
create policy bizguard_captures_admin_select
on storage.objects
for select to authenticated
using (
  bucket_id = 'bizguard-captures'
  and public.is_current_user_super_admin()
);

-- Verification: this query should return exactly one row after migration.
-- select id, name, public, file_size_limit, allowed_mime_types
-- from storage.buckets
-- where id = 'bizguard-captures';
