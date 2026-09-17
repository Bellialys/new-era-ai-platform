-- Security hardening for privileged admin mutations.
-- The RPCs keep the protected mutation and its audit row in one transaction.
-- The trigger serializes admin demotions and preserves at least one admin.

create or replace function public.prevent_last_admin_demotion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.role = 'admin' and new.role <> 'admin' then
    perform pg_catalog.pg_advisory_xact_lock(20260824, 1);

    if not exists (
      select 1
      from public.profiles
      where role = 'admin'
        and id <> old.id
    ) then
      raise exception using errcode = 'P0001', message = 'ADMIN_LAST_ADMIN';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_preserve_last_admin on public.profiles;
create trigger profiles_preserve_last_admin
before update of role on public.profiles
for each row
execute function public.prevent_last_admin_demotion();

create or replace function public.admin_update_user_with_audit(
  p_actor_id uuid,
  p_target_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before record;
  v_action text;
begin
  if p_actor_id is null or p_target_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_MUTATION';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_AUTH_REQUIRED';
  end if;

  if p_updates is null
     or pg_catalog.jsonb_typeof(p_updates) <> 'object'
     or p_updates = '{}'::jsonb
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_updates) as keys(key)
       where key not in ('role', 'plan')
     ) then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_MUTATION';
  end if;

  if p_updates ? 'role'
     and (
       pg_catalog.jsonb_typeof(p_updates -> 'role') <> 'string'
       or p_updates ->> 'role' not in ('user', 'admin')
     ) then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_ROLE';
  end if;

  if p_updates ? 'plan'
     and (
       pg_catalog.jsonb_typeof(p_updates -> 'plan') <> 'string'
       or p_updates ->> 'plan' not in ('free', 'pro')
     ) then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_PLAN';
  end if;

  select role, plan
  into v_before
  from public.profiles
  where id = p_target_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'USER_NOT_FOUND';
  end if;

  if v_before.role = 'admin'
     and p_updates ->> 'role' = 'user'
     and p_actor_id = p_target_id then
    raise exception using errcode = 'P0001', message = 'ADMIN_SELF_DEMOTION';
  end if;

  update public.profiles
  set
    role = case when p_updates ? 'role' then p_updates ->> 'role' else role end,
    plan = case when p_updates ? 'plan' then p_updates ->> 'plan' else plan end
  where id = p_target_id;

  v_action := case when p_updates ? 'role' then 'user.role_change' else 'user.plan_change' end;

  insert into public.audit_log (actor_id, action, target_type, target_id, payload)
  values (
    p_actor_id,
    v_action,
    'user',
    p_target_id::text,
    pg_catalog.jsonb_build_object(
      'before', pg_catalog.jsonb_build_object('role', v_before.role, 'plan', v_before.plan),
      'after', p_updates
    )
  );
end;
$$;

create or replace function public.admin_update_model_with_audit(
  p_actor_id uuid,
  p_target_id uuid,
  p_updates jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_before record;
begin
  if p_actor_id is null or p_target_id is null then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_MUTATION';
  end if;

  if not exists (
    select 1 from public.profiles where id = p_actor_id and role = 'admin'
  ) then
    raise exception using errcode = 'P0001', message = 'ADMIN_AUTH_REQUIRED';
  end if;

  if p_updates is null
     or pg_catalog.jsonb_typeof(p_updates) <> 'object'
     or p_updates = '{}'::jsonb
     or exists (
       select 1
       from pg_catalog.jsonb_object_keys(p_updates) as keys(key)
       where key not in ('is_active', 'display_name', 'access_level')
     ) then
    raise exception using errcode = '22023', message = 'INVALID_ADMIN_MUTATION';
  end if;

  if p_updates ? 'is_active'
     and pg_catalog.jsonb_typeof(p_updates -> 'is_active') <> 'boolean' then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_STATUS';
  end if;

  if p_updates ? 'display_name'
     and (
       pg_catalog.jsonb_typeof(p_updates -> 'display_name') <> 'string'
       or length(pg_catalog.btrim(p_updates ->> 'display_name')) not between 1 and 100
     ) then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_NAME';
  end if;

  if p_updates ? 'access_level'
     and (
       pg_catalog.jsonb_typeof(p_updates -> 'access_level') <> 'string'
       or p_updates ->> 'access_level' not in ('anonymous', 'registered', 'premium')
     ) then
    raise exception using errcode = '22023', message = 'INVALID_MODEL_ACCESS_LEVEL';
  end if;

  select is_active, display_name, access_level
  into v_before
  from public.models
  where id = p_target_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'MODEL_NOT_FOUND';
  end if;

  update public.models
  set
    is_active = case
      when p_updates ? 'is_active' then (p_updates ->> 'is_active')::boolean
      else is_active
    end,
    display_name = case
      when p_updates ? 'display_name' then p_updates ->> 'display_name'
      else display_name
    end,
    access_level = case
      when p_updates ? 'access_level' then p_updates ->> 'access_level'
      else access_level
    end
  where id = p_target_id;

  insert into public.audit_log (actor_id, action, target_type, target_id, payload)
  values (
    p_actor_id,
    'model.update',
    'model',
    p_target_id::text,
    pg_catalog.jsonb_build_object(
      'before', pg_catalog.jsonb_build_object(
        'is_active', v_before.is_active,
        'display_name', v_before.display_name,
        'access_level', v_before.access_level
      ),
      'after', p_updates
    )
  );
end;
$$;

revoke execute on function public.prevent_last_admin_demotion() from public, anon, authenticated;
revoke execute on function public.admin_update_user_with_audit(uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.admin_update_model_with_audit(uuid, uuid, jsonb) from public, anon, authenticated;

grant execute on function public.admin_update_user_with_audit(uuid, uuid, jsonb) to service_role;
grant execute on function public.admin_update_model_with_audit(uuid, uuid, jsonb) to service_role;
grant update (is_active, display_name, access_level) on public.models to service_role;

comment on function public.admin_update_user_with_audit(uuid, uuid, jsonb) is
  'Service-role-only atomic admin profile mutation with mandatory audit insertion.';
comment on function public.admin_update_model_with_audit(uuid, uuid, jsonb) is
  'Service-role-only atomic model mutation with mandatory audit insertion.';
