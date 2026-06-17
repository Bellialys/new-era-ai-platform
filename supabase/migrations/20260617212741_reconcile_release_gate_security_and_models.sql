-- v0.7.0-alpha.1 release-gate reconciliation.
--
-- Forward-only changes:
-- 1. Normalize model catalog governance metadata.
-- 2. Deactivate OpenRouter IDs that are not in the verified local catalog.
-- 3. Make models.status generated from is_active.
-- 4. Remove SECURITY DEFINER from the public cast_best_vote RPC while keeping
--    execution restricted to the server-side service_role client.

update public.models
set
  raw_metadata = raw_metadata || jsonb_build_object(
    'catalog_governance_version', 'v0.7.0-alpha.1',
    'provider', provider,
    'display_name', display_name,
    'price_label', price_label,
    'pricing_type', price_label,
    'max_output_tokens', max_output_tokens,
    'is_active', is_active,
    'status', case when is_active then 'active' else 'inactive' end,
    'supports_text', true,
    'supports_code', role_tags && array['coding'],
    'supports_image_input', false,
    'supports_image_generation', false,
    'verification_status', coalesce(raw_metadata ->> 'verification_status', 'needs_openrouter_check'),
    'openrouter_verified_at', raw_metadata -> 'openrouter_verified_at'
  ),
  updated_at = now()
where provider = 'openrouter';

update public.models
set
  is_active = false,
  is_public = false,
  raw_metadata = raw_metadata || jsonb_build_object(
    'is_active', false,
    'status', 'inactive',
    'verification_status', 'not_found_in_openrouter_models_verify',
    'openrouter_verified_at', '2026-06-18'
  ),
  updated_at = now()
where provider = 'openrouter'
  and model_key in (
    'z-ai/glm-4.5-air:free',
    'moonshotai/kimi-k2.6:free'
  );

do $$
declare
  v_is_generated text;
begin
  select is_generated
    into v_is_generated
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'models'
    and column_name = 'status';

  if v_is_generated is null then
    alter table public.models
      add column status text
      generated always as (
        case
          when is_active then 'active'
          else 'inactive'
        end
      ) stored;
  elsif v_is_generated = 'NEVER' then
    if exists (
      select 1
      from public.models
      where status is not null
        and status not in ('active', 'inactive')
    ) then
      raise exception 'models.status contains values that cannot be safely regenerated';
    end if;

    alter table public.models drop column status;
    alter table public.models
      add column status text
      generated always as (
        case
          when is_active then 'active'
          else 'inactive'
        end
      ) stored;
  end if;
end $$;

comment on column public.models.status is
  'Generated model lifecycle status derived from is_active: active or inactive.';

create or replace function public.cast_best_vote(
  p_task_id uuid,
  p_response_id uuid,
  p_user_id uuid,
  p_anon_id text
)
returns public.votes
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_response_status text;
  v_vote public.votes;
begin
  if (p_user_id is null) = (p_anon_id is null) then
    raise exception 'VOTER_REQUIRED';
  end if;

  select status
    into v_response_status
  from public.model_responses
  where id = p_response_id
    and task_id = p_task_id;

  if not found then
    raise exception 'RESPONSE_NOT_FOUND';
  end if;

  if v_response_status <> 'success' then
    raise exception 'INVALID_VOTE_TARGET';
  end if;

  if p_user_id is not null then
    delete from public.votes
    where task_id = p_task_id
      and vote_type = 'best'
      and user_id = p_user_id;
  else
    delete from public.votes
    where task_id = p_task_id
      and vote_type = 'best'
      and anonymous_session_id = p_anon_id;
  end if;

  insert into public.votes (
    task_id,
    model_response_id,
    user_id,
    anonymous_session_id,
    vote_type
  )
  values (
    p_task_id,
    p_response_id,
    p_user_id,
    p_anon_id,
    'best'
  )
  returning * into v_vote;

  return v_vote;
end;
$$;

revoke execute on function public.cast_best_vote(uuid, uuid, uuid, text)
  from public, anon, authenticated;

grant execute on function public.cast_best_vote(uuid, uuid, uuid, text)
  to service_role;
