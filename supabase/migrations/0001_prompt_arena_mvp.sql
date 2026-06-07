create extension if not exists pgcrypto;

create table if not exists public.models (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openrouter',
  model_key text not null unique,
  display_name text not null,
  description text,
  price_label text not null default 'unknown',
  is_active boolean not null default true,
  is_public boolean not null default true,
  role_tags text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  input_price_per_million numeric,
  output_price_per_million numeric,
  sort_order integer not null default 100,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint models_price_label_check check (
    price_label in ('free', 'cheap', 'balanced', 'expensive', 'unknown')
  ),
  constraint models_context_length_check check (
    context_length is null or context_length > 0
  ),
  constraint models_max_output_tokens_check check (
    max_output_tokens is null or max_output_tokens > 0
  )
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  mode_slug text not null default 'prompt-arena',
  prompt_text text not null,
  prompt_hash text,
  title text,
  status text not null default 'pending',
  selected_models jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_prompt_text_length check (char_length(prompt_text) between 3 and 8000),
  constraint tasks_mode_slug_check check (mode_slug in ('prompt-arena')),
  constraint tasks_status_check check (
    status in ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled')
  )
);

create table if not exists public.model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_id uuid references public.models(id) on delete set null,
  model_key text not null,
  display_name text,
  response_text text,
  status text not null default 'success',
  error_code text,
  error_message text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint model_responses_status_check check (
    status in ('success', 'error', 'timeout', 'cancelled')
  ),
  constraint model_responses_latency_check check (
    latency_ms is null or latency_ms >= 0
  )
);

create index if not exists models_is_active_idx on public.models (is_active);
create index if not exists models_is_public_idx on public.models (is_public);
create index if not exists models_sort_order_idx on public.models (sort_order);
create index if not exists tasks_created_at_idx on public.tasks (created_at desc);
create index if not exists tasks_mode_slug_idx on public.tasks (mode_slug);
create index if not exists tasks_status_idx on public.tasks (status);
create index if not exists model_responses_task_id_idx on public.model_responses (task_id);
create index if not exists model_responses_model_id_idx on public.model_responses (model_id);
create index if not exists model_responses_model_key_idx on public.model_responses (model_key);
create index if not exists model_responses_status_idx on public.model_responses (status);

alter table public.models enable row level security;
alter table public.tasks enable row level security;
alter table public.model_responses enable row level security;

drop policy if exists "Public can read active public models" on public.models;
create policy "Public can read active public models"
on public.models
for select
using (is_active = true and is_public = true);

insert into public.models (
  provider,
  model_key,
  display_name,
  description,
  price_label,
  is_active,
  is_public,
  role_tags,
  sort_order
)
values
(
  'openrouter',
  'google/gemini-3.5-flash',
  'Gemini 3.5 Flash',
  'Актуальная скоростная модель Google для быстрых и чётких ответов.',
  'balanced',
  true,
  true,
  array['fast'],
  10
),
(
  'openrouter',
  'mistralai/mistral-small-3.1-24b-instruct',
  'Mistral Small 3.1',
  'Сильная модель Mistral для глубокого анализа и рассуждений.',
  'balanced',
  true,
  true,
  array['balanced'],
  20
),
(
  'openrouter',
  'meta-llama/llama-3.1-8b-instruct',
  'Llama 3.1 8B',
  'Открытая модель Meta — хороший баланс скорости и качества.',
  'cheap',
  true,
  true,
  array['open-source'],
  30
)
on conflict (model_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  price_label = excluded.price_label,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  role_tags = excluded.role_tags,
  sort_order = excluded.sort_order,
  updated_at = now();
