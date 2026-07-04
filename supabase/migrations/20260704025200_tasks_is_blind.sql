alter table public.tasks
  add column if not exists is_blind boolean not null default false;
