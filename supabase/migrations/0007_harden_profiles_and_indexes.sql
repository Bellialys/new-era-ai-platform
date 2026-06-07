-- Harden Supabase security/performance warnings for the MVP database.
-- This migration keeps public access closed for user-generated arena data while
-- allowing the server-only service_role client to persist Prompt Arena runs.

-- Keep the updated_at trigger deterministic and remove the mutable search_path warning.
create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Keep the auth signup trigger explicit and deterministic.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(coalesce(new.raw_user_meta_data ->> 'display_name', ''), '')
  )
  on conflict (id) do update set
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$;

-- These functions are used internally by triggers/admin logic, not as public RPC endpoints.
revoke execute on function public.set_profiles_updated_at() from public, anon, authenticated;
revoke execute on function public.handle_new_user_profile() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Make RLS intent explicit for server-only writes. Public/anon users still get no
-- direct access to tasks or model_responses.
drop policy if exists "Service role can manage tasks" on public.tasks;
create policy "Service role can manage tasks"
on public.tasks
for all
to service_role
using (true)
with check (true);

drop policy if exists "Service role can manage model responses" on public.model_responses;
create policy "Service role can manage model responses"
on public.model_responses
for all
to service_role
using (true)
with check (true);

-- Optimize future authenticated task queries.
create index if not exists tasks_user_id_idx
on public.tasks(user_id)
where user_id is not null;

-- Avoid per-row auth.uid() re-evaluation in profile policies.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);
