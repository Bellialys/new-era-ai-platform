create table public.model_health_runs (
  run_date date primary key,
  source text not null check (source in ('scheduled', 'manual')),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error_code text check (error_code in (
    'MODEL_HEALTH_CREDENTIALS_MISSING',
    'MODEL_HEALTH_SYNC_FAILED',
    'MODEL_HEALTH_DEADLINE_EXCEEDED'
  )),
  inference_calls integer not null default 0 check (inference_calls between 0 and 5),
  checked integer not null default 0 check (checked between 0 and 5),
  healthy integer not null default 0 check (healthy between 0 and checked),
  hidden integer not null default 0 check (hidden between 0 and checked),
  restored integer not null default 0 check (restored between 0 and checked),
  discovered integer not null default 0 check (discovered between 0 and checked),
  published integer not null default 0 check (published between 0 and checked),
  skipped integer not null default 0 check (skipped between 0 and 5),
  constraint model_health_runs_utc_date check (run_date = (started_at at time zone 'UTC')::date),
  constraint model_health_runs_finished_at check (finished_at is null or finished_at >= started_at),
  constraint model_health_runs_outcome check (
    (status = 'running' and finished_at is null and error_code is null)
    or (status = 'succeeded' and finished_at is not null and error_code is null)
    or (status = 'failed' and finished_at is not null and error_code is not null)
  )
);

alter table public.model_health_runs enable row level security;

revoke all on table public.model_health_runs from public, anon, authenticated, service_role;
grant select on table public.model_health_runs to service_role;
grant insert (run_date, source, started_at) on table public.model_health_runs to service_role;
grant update (
  status, finished_at, error_code, inference_calls, checked, healthy, hidden,
  restored, discovered, published, skipped
) on table public.model_health_runs to service_role;
