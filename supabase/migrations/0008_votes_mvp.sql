-- Voting MVP (v0.6)
-- Stores one saved winner response for each Prompt Arena task.

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  response_id uuid not null references public.model_responses(id) on delete cascade,
  anonymous_session_id text,
  vote_type text not null default 'winner',
  created_at timestamptz not null default now(),
  constraint votes_vote_type_check check (vote_type in ('winner')),
  constraint votes_anonymous_session_length check (
    anonymous_session_id is null or char_length(anonymous_session_id) <= 128
  )
);

-- MVP rule: one saved winner per task.
create unique index if not exists votes_one_winner_per_task_idx
on public.votes(task_id, vote_type);

create index if not exists votes_response_id_idx
on public.votes(response_id);

alter table public.votes enable row level security;

drop policy if exists "Service role can manage votes" on public.votes;
create policy "Service role can manage votes"
on public.votes
for all
to service_role
using (true)
with check (true);

grant select, insert, update on public.votes to service_role;
