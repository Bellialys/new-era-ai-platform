-- Finalize tasks.task_text as the canonical task input field.
-- This migration removes the temporary prompt_text compatibility layer.

update public.tasks
set task_text = prompt_text
where task_text is null
  and prompt_text is not null;

alter table public.tasks
  alter column task_text set not null;

alter table public.tasks
  drop constraint if exists tasks_prompt_text_length;

alter table public.tasks
  drop constraint if exists tasks_task_text_length;

alter table public.tasks
  add constraint tasks_task_text_length
  check (char_length(task_text) >= 3 and char_length(task_text) <= 8000);

drop trigger if exists sync_task_prompt_text_before_write on public.tasks;

drop function if exists public.sync_task_prompt_text();

alter table public.tasks
  drop column if exists prompt_text;

comment on column public.tasks.task_text is 'Canonical task text field for MVP and future Arena modes.';
