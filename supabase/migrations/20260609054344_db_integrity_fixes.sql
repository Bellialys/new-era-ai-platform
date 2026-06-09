-- DB integrity & security fixes (audit 2026-06-09)
-- 1) pin search_path on sync_task_prompt_text
-- 2) auto-update updated_at on tasks & models
-- 3) prevent duplicate votes on public.votes

-- 1) SECURITY: pin search_path (body only touches NEW.* columns)
alter function public.sync_task_prompt_text() set search_path = '';

-- 2) updated_at automation (generic hardened trigger fn + triggers)
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

drop trigger if exists models_set_updated_at on public.models;
create trigger models_set_updated_at
  before update on public.models
  for each row
  execute function public.set_updated_at();

-- 3) VOTES uniqueness (partial indexes for auth + guest voters)
create unique index if not exists votes_best_per_user_uniq
  on public.votes (task_id, user_id)
  where vote_type = 'best' and user_id is not null;

create unique index if not exists votes_best_per_anon_uniq
  on public.votes (task_id, anonymous_session_id)
  where vote_type = 'best' and anonymous_session_id is not null;

create unique index if not exists votes_reaction_per_user_uniq
  on public.votes (model_response_id, user_id, vote_type)
  where vote_type in ('like', 'dislike') and user_id is not null;

create unique index if not exists votes_reaction_per_anon_uniq
  on public.votes (model_response_id, anonymous_session_id, vote_type)
  where vote_type in ('like', 'dislike') and anonymous_session_id is not null;
