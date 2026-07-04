-- Security hardening (audit 2026-07-04):
-- 1) P0: close self-escalation via column grants on profiles
-- 2) P1: remove legacy TRUNCATE/REFERENCES/TRIGGER from public roles
-- 3) Hardening: make avatar UPDATE WITH CHECK explicit

-- 1) profiles: UPDATE only on safe columns.
--    role/plan/email/id/created_at/updated_at are not written by clients.
--    email is set only at signup via handle_new_user_profile trigger (AFTER INSERT on auth.users).
--    updated_at is set by the profiles_set_updated_at trigger.
--    Admin writes to role/plan go through requireAdmin() (service role), not affected by this grant.
revoke update on public.profiles from authenticated;
grant  update (first_name, last_name, display_name, avatar_url)
       on public.profiles to authenticated;

-- 2) legacy grants: remove unnecessary privileges from public roles.
--    TRUNCATE/REFERENCES/TRIGGER were never required for application operation.
revoke truncate, references, trigger
  on public.profiles, public.tasks, public.model_responses,
     public.models, public.votes
  from anon, authenticated;

-- 3) storage: recreate avatar UPDATE policy with WITH CHECK,
--    identical to USING (replacement row must stay in the same own-folder boundary).
--    PostgreSQL uses USING as the implicit check when WITH CHECK is omitted
--    for UPDATE policies, but keeping it explicit prevents future policy drift.
drop policy if exists "Authenticated users can update own avatar" on storage.objects;
create policy "Authenticated users can update own avatar"
  on storage.objects for update to authenticated
  using      (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
