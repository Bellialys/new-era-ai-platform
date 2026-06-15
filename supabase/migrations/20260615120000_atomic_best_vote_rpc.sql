-- Atomic "best" vote casting.
--
-- Replaces the previous delete-then-insert flow in the application layer with a
-- single transactional function. This removes the race where two concurrent
-- votes from the same voter could both delete and then collide on the unique
-- best-vote index. The function also validates the target response so a vote is
-- only accepted for a successful response that belongs to the given task.
--
-- Identity is passed in already-verified by the backend (a Supabase user id or
-- a server-issued guest id); the function is invoked only by the service-role
-- client, never directly by anon/authenticated roles.

create or replace function public.cast_best_vote(
  p_task_id uuid,
  p_response_id uuid,
  p_user_id uuid,
  p_anon_id text
)
returns public.votes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_status text;
  v_vote public.votes;
begin
  -- Exactly one voter identity must be supplied.
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

  -- Replace any previous best vote by this voter for this task.
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

-- Called only by the server-side service-role client. Keep it off public RPC.
revoke execute on function public.cast_best_vote(uuid, uuid, uuid, text)
  from public, anon, authenticated;
