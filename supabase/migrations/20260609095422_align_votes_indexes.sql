-- Align votes indexes with the current voting model.
-- best votes are unique per task + voter.
-- like/dislike reactions are unique per model_response + voter + vote_type.

-- Remove old broad MVP indexes that incorrectly limit like/dislike to one per task.
drop index if exists public.votes_one_user_vote_per_task_type_idx;
drop index if exists public.votes_one_anonymous_vote_per_task_type_idx;

-- Ensure the current intended indexes exist.
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

-- Keep updated_at accurate when vote rows are updated by upsert/update flows.
drop trigger if exists votes_set_updated_at on public.votes;
create trigger votes_set_updated_at
  before update on public.votes
  for each row
  execute function public.set_updated_at();
