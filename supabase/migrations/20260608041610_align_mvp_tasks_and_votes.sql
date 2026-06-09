-- Align tasks table with project documentation while keeping backward compatibility.

alter table public.tasks
  add column if not exists task_text text;

update public.tasks
set task_text = prompt_text
where task_text is null
  and prompt_text is not null;

create or replace function public.sync_task_prompt_text()
returns trigger
language plpgsql
as $$
begin
  if new.task_text is null and new.prompt_text is not null then
    new.task_text := new.prompt_text;
  end if;

  if new.prompt_text is null and new.task_text is not null then
    new.prompt_text := new.task_text;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_task_prompt_text_before_write on public.tasks;

create trigger sync_task_prompt_text_before_write
before insert or update on public.tasks
for each row
execute function public.sync_task_prompt_text();

alter table public.tasks
  drop constraint if exists tasks_mode_slug_check;

alter table public.tasks
  add constraint tasks_mode_slug_check
  check (
    mode_slug in (
      'prompt-arena',
      'code-arena',
      'multi-model-battle',
      'ai-team-mode',
      'judge-mode',
      'leaderboard'
    )
  );

alter table public.tasks
  drop constraint if exists tasks_task_text_length;

alter table public.tasks
  add constraint tasks_task_text_length
  check (task_text is null or (char_length(task_text) >= 3 and char_length(task_text) <= 8000));

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_response_id uuid not null references public.model_responses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  vote_type text not null default 'best',
  reason text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  constraint votes_voter_required check (user_id is not null or anonymous_session_id is not null),
  constraint votes_vote_type_check check (vote_type in ('best', 'like', 'dislike'))
);

alter table public.votes enable row level security;

drop policy if exists "Service role can manage votes" on public.votes;
create policy "Service role can manage votes"
on public.votes
for all
to service_role
using (true)
with check (true);

create index if not exists votes_task_id_idx on public.votes(task_id);
create index if not exists votes_model_response_id_idx on public.votes(model_response_id);
create index if not exists votes_user_id_idx on public.votes(user_id);

create unique index if not exists votes_one_user_vote_per_task_type_idx
on public.votes(task_id, user_id, vote_type)
where user_id is not null;

create unique index if not exists votes_one_anonymous_vote_per_task_type_idx
on public.votes(task_id, anonymous_session_id, vote_type)
where anonymous_session_id is not null;

comment on column public.tasks.task_text is 'Canonical task text field for MVP. prompt_text is kept temporarily for backward compatibility.';
comment on table public.votes is 'Stores user or anonymous votes for model responses in MVP comparison flow.';
