-- Enforce task ownership inside the atomic best-vote RPC before any blind
-- reveal can be returned by the API route.
--
-- SECURITY INVOKER is kept intentionally: the application calls this function
-- only through the server-side service-role client, and public execution stays
-- revoked below.

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
  v_task_status text;
  v_vote public.votes;
begin
  if (p_user_id is null) = (p_anon_id is null) then
    raise exception 'VOTER_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_task_id::text || ':' || coalesce(p_user_id::text, p_anon_id),
      0
    )
  );

  select status
    into v_task_status
  from public.tasks
  where id = p_task_id
    and (
      (p_user_id is not null and user_id = p_user_id)
      or (p_anon_id is not null and anonymous_session_id = p_anon_id)
    );

  if v_task_status is null then
    raise exception 'TASK_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_task_status = 'running' then
    raise exception 'TASK_STILL_RUNNING' using errcode = 'P0001';
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
