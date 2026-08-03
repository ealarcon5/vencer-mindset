-- Migration 0002: private storage bucket for proof photos/videos.
-- Files are stored under  proof-media/<user_id>/<checkin_id>.<ext>  and are
-- served to bet participants via short-lived signed URLs (never public).

insert into storage.buckets (id, name, public)
values ('proof-media', 'proof-media', false)
on conflict (id) do nothing;

-- A user may upload only into their own folder.
create policy "proof upload own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- A user may read their own proof media. (Cross-participant viewing is done
-- through signed URLs minted by an Edge Function, so no broad read policy here.)
create policy "proof read own"
  on storage.objects for select
  using (
    bucket_id = 'proof-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
