-- Serialize role-update statements before they lock profile rows, then verify
-- the invariant against lock-refreshed tuples after the statement completes.
-- A row-level advisory lock alone can observe a stale statement snapshot after
-- waiting, allowing two concurrent demotions to both pass the last-admin check.

create or replace function public.serialize_admin_role_updates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(20260824, 1);
  return null;
end;
$$;

create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform id
  from public.profiles
  where role = 'admin'
  order by id
  limit 1
  for key share;

  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_LAST_ADMIN';
  end if;

  return null;
end;
$$;

drop trigger if exists profiles_serialize_admin_role_updates on public.profiles;
create trigger profiles_serialize_admin_role_updates
before update of role on public.profiles
for each statement
execute function public.serialize_admin_role_updates();

drop trigger if exists profiles_preserve_last_admin on public.profiles;
create trigger profiles_preserve_last_admin
after update of role on public.profiles
for each statement
execute function public.prevent_last_admin_demotion();

revoke execute on function public.serialize_admin_role_updates() from public, anon, authenticated;
revoke execute on function public.prevent_last_admin_demotion() from public, anon, authenticated;

comment on function public.serialize_admin_role_updates() is
  'Serializes profile role-update statements before row locks are acquired.';
comment on function public.prevent_last_admin_demotion() is
  'Rejects a completed role-update statement when no administrator remains.';
