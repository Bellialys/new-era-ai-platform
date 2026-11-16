-- Unified compare quota hardening.
-- Forward-only. Apply only to an isolated local/test database during validation.
-- Production apply, backfill and cutover require an approved release operation.

create table if not exists public.compare_quota_buckets (
  namespace text not null,
  subject_key text not null,
  bucket_kind text not null check (bucket_kind in ('day', 'minute')),
  bucket_start timestamptz not null,
  units bigint not null default 0 check (units >= 0),
  primary key (namespace, subject_key, bucket_kind, bucket_start)
);

create table if not exists public.compare_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,
  subject_key text not null,
  idempotency_key text not null,
  fingerprint text not null,
  units integer not null default 1 check (units = 1),
  day_bucket timestamptz not null,
  minute_bucket timestamptz not null,
  status text not null default 'reserved'
    check (status in ('reserved', 'completed', 'abandoned')),
  response_payload jsonb,
  response_status integer check (response_status between 200 and 599),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (namespace, subject_key, idempotency_key)
);

create index if not exists idx_compare_quota_reservations_created
  on public.compare_quota_reservations (created_at desc);

-- Keep the maintenance sweep efficient without indexing the sensitive JSON.
create index if not exists idx_compare_quota_reservations_unfinished
  on public.compare_quota_reservations (created_at)
  where status = 'reserved';
create index if not exists idx_compare_quota_reservations_payload_expiry
  on public.compare_quota_reservations (completed_at)
  where status = 'completed' and response_payload is not null;

alter table public.compare_quota_buckets enable row level security;
alter table public.compare_quota_reservations enable row level security;

revoke all on table public.compare_quota_buckets from public, anon, authenticated, service_role;
revoke all on table public.compare_quota_reservations from public, anon, authenticated, service_role;

-- The tables are intentionally inaccessible to API roles. Only the definer
-- functions below can read/write them, and only service_role may execute those
-- functions. No client-supplied plan or limit is accepted by either function.

drop function if exists public.reserve_compare_quota(uuid, text, text, text);
create or replace function public.reserve_compare_quota(
  p_user_id uuid,
  p_guest_id text,
  p_idempotency_key text,
  p_fingerprint text
)
returns table (
  reservation_id uuid,
  outcome text,
  retry_after_seconds integer,
  response_payload jsonb,
  response_status integer
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_day_bucket timestamptz := date_trunc('day', v_now at time zone 'UTC') at time zone 'UTC';
  v_minute_bucket timestamptz := date_trunc('minute', v_now at time zone 'UTC') at time zone 'UTC';
  v_subject_key text;
  v_namespace constant text := 'prompt-arena-compare';
  v_role text;
  v_plan text;
  v_daily_limit integer;
  v_minute_limit integer;
  v_day_used bigint;
  v_minute_used bigint;
  v_existing public.compare_quota_reservations%rowtype;
  v_retry_after integer;
begin
  if (p_user_id is null) = (p_guest_id is null)
     or nullif(trim(p_idempotency_key), '') is null
     or length(p_idempotency_key) > 128
     or p_fingerprint is null then
    return query select null::uuid, 'authority_error'::text, null::integer, null::jsonb, null::integer;
    return;
  end if;

  if p_user_id is not null then
    v_subject_key := 'user:' || p_user_id::text;
    select role, plan into v_role, v_plan from public.profiles where id = p_user_id;
    if not found then
      v_role := 'user';
      v_plan := 'free';
    end if;
    v_daily_limit := case
      when v_role = 'admin' then 9999
      when v_plan = 'pro' then 100
      else 20
    end;
    v_minute_limit := 10;
  else
    v_subject_key := 'guest:' || p_guest_id;
    v_daily_limit := 5;
    v_minute_limit := 5;
  end if;

  -- Serialize every reservation for one identity across all app instances.
  perform pg_advisory_xact_lock(hashtextextended(v_namespace || ':' || v_subject_key, 0));

  select * into v_existing
    from public.compare_quota_reservations
   where namespace = v_namespace
     and subject_key = v_subject_key
     and idempotency_key = trim(p_idempotency_key)
   for update;

  if found then
    if v_existing.fingerprint <> p_fingerprint then
      return query select v_existing.id, 'idempotency_mismatch'::text, null::integer, null::jsonb, null::integer;
    elsif v_existing.status = 'completed' then
      if v_existing.response_payload is not null and v_existing.response_status is not null then
        return query select v_existing.id, 'replayed'::text, null::integer,
          v_existing.response_payload, v_existing.response_status;
      else
        -- A retained idempotency key must NOT result in a new paid inference
        -- once the cached answer was scrubbed by the privacy retention job.
        return query select v_existing.id, 'result_expired'::text, null::integer, null::jsonb, null::integer;
      end if;
    elsif v_existing.status = 'abandoned' then
      return query select v_existing.id, 'result_expired'::text, null::integer, null::jsonb, null::integer;
    elsif v_existing.created_at < v_now - interval '15 minutes' then
      -- Self-heal a reservation orphaned by a crash or a completion outage.
      -- Do not refund quota or repeat paid provider work for the same key.
      update public.compare_quota_reservations
         set status = 'abandoned'
       where id = v_existing.id and status = 'reserved';
      return query select v_existing.id, 'result_expired'::text, null::integer, null::jsonb, null::integer;
    else
      -- The original request may still be working. The caller can poll
      -- using the same idempotency key and MUST NOT start new provider calls.
      return query select v_existing.id, 'in_progress'::text, 5::integer, null::jsonb, null::integer;
    end if;
    return;
  end if;

  insert into public.compare_quota_buckets(namespace, subject_key, bucket_kind, bucket_start)
  values (v_namespace, v_subject_key, 'day', v_day_bucket)
  on conflict do nothing;
  insert into public.compare_quota_buckets(namespace, subject_key, bucket_kind, bucket_start)
  values (v_namespace, v_subject_key, 'minute', v_minute_bucket)
  on conflict do nothing;

  select units into v_day_used
    from public.compare_quota_buckets
   where namespace = v_namespace and subject_key = v_subject_key
     and bucket_kind = 'day' and bucket_start = v_day_bucket
   for update;
  select units into v_minute_used
    from public.compare_quota_buckets
   where namespace = v_namespace and subject_key = v_subject_key
     and bucket_kind = 'minute' and bucket_start = v_minute_bucket
   for update;

  if v_day_used >= v_daily_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_day_bucket + interval '1 day' - v_now)))::integer);
    return query select null::uuid, 'quota_exceeded'::text, v_retry_after, null::jsonb, null::integer;
    return;
  end if;
  if v_minute_used >= v_minute_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_minute_bucket + interval '1 minute' - v_now)))::integer);
    return query select null::uuid, 'quota_exceeded'::text, v_retry_after, null::jsonb, null::integer;
    return;
  end if;

  update public.compare_quota_buckets
     set units = units + 1
   where namespace = v_namespace and subject_key = v_subject_key
     and bucket_kind = 'day' and bucket_start = v_day_bucket;
  update public.compare_quota_buckets
     set units = units + 1
   where namespace = v_namespace and subject_key = v_subject_key
     and bucket_kind = 'minute' and bucket_start = v_minute_bucket;

  insert into public.compare_quota_reservations (
    namespace, subject_key, idempotency_key, fingerprint, day_bucket, minute_bucket
  ) values (
    v_namespace, v_subject_key, trim(p_idempotency_key), p_fingerprint, v_day_bucket, v_minute_bucket
  ) returning id into reservation_id;

  return query select reservation_id, 'accepted'::text, null::integer, null::jsonb, null::integer;
end;
$$;

revoke all on function public.reserve_compare_quota(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.reserve_compare_quota(uuid, text, text, text) to service_role;

drop function if exists public.complete_compare_quota(uuid, jsonb, integer);
create or replace function public.complete_compare_quota(
  p_reservation_id uuid,
  p_response_payload jsonb,
  p_response_status integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $
declare
  v_existing public.compare_quota_reservations%rowtype;
begin
  if p_reservation_id is null or p_response_payload is null
     or p_response_status not between 200 and 599 then
    raise exception 'invalid quota completion payload' using errcode = '22023';
  end if;

  update public.compare_quota_reservations
     set status = 'completed',
         response_payload = p_response_payload,
         response_status = p_response_status,
         completed_at = clock_timestamp()
   where id = p_reservation_id
     and status = 'reserved';
  if found then
    return;
  end if;

  -- A network timeout can happen *after* the first DB transaction committed.
  -- Exact duplicate completion is successful, so the application can retry
  -- the RPC safely without creating another inference request.
  select * into v_existing from public.compare_quota_reservations
   where id = p_reservation_id;
  if found and v_existing.status = 'completed'
     and v_existing.response_status = p_response_status
     and v_existing.response_payload = p_response_payload then
    return;
  end if;

  -- A missing, abandoned, scrubbed or mismatched result is not silently
  -- accepted. This never creates or refunds a new reservation.
  raise exception 'quota reservation is not completable' using errcode = 'P0001';
end;
$;

revoke all on function public.complete_compare_quota(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.complete_compare_quota(uuid, jsonb, integer) to service_role;

-- Cutover support: initialize the current UTC day bucket from legacy tasks.
-- GREATEST preserves an already-reserved count and never resets usage.
drop function if exists public.backfill_compare_quota_current_day();
create or replace function public.backfill_compare_quota_current_day()
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_day_bucket timestamptz := date_trunc('day', clock_timestamp() at time zone 'UTC') at time zone 'UTC';
  v_rows bigint := 0;
  v_item record;
begin
  for v_item in
    select case when user_id is not null then 'user:' || user_id::text
                else 'guest:' || anonymous_session_id end as subject_key,
           count(*)::bigint as units
      from public.tasks
     where created_at >= v_day_bucket
       -- This namespace only meters Prompt Arena compares. Code Arena,
       -- AI Team and other task modes use independent cost/usage policies.
       and mode_slug = 'prompt-arena'
       and (user_id is not null or anonymous_session_id is not null)
     group by 1
  loop
    insert into public.compare_quota_buckets(namespace, subject_key, bucket_kind, bucket_start, units)
    values ('prompt-arena-compare', v_item.subject_key, 'day', v_day_bucket, v_item.units)
    on conflict (namespace, subject_key, bucket_kind, bucket_start)
    do update set units = greatest(public.compare_quota_buckets.units, excluded.units);
    v_rows := v_rows + 1;
  end loop;
  return v_rows;
end;
$$;

revoke all on function public.backfill_compare_quota_current_day() from public, anon, authenticated;
grant execute on function public.backfill_compare_quota_current_day() to service_role;

-- Maintenance is service-role-only and deliberately NOT scheduled by this
-- draft migration. The release runbook must configure an audited daily job.
-- In-flight work has 15 minutes (well beyond request timeouts); after that,
-- orphaned requests become unreplayable without refunding provider quota.
-- Full response JSON is retained no longer than 24 hours after completion.
-- Idempotency metadata is deleted after 30 days. UTC buckets older than
-- three days no longer affect any active daily/minute quota.
drop function if exists public.maintain_compare_quota();
create or replace function public.maintain_compare_quota()
returns table (
  abandoned_count bigint,
  scrubbed_count bigint,
  deleted_reservations bigint,
  deleted_buckets bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $
declare
  v_now timestamptz := clock_timestamp();
begin
  update public.compare_quota_reservations
     set status = 'abandoned'
   where status = 'reserved' and created_at < v_now - interval '15 minutes';
  get diagnostics abandoned_count = row_count;

  update public.compare_quota_reservations
     set response_payload = null
   where status = 'completed'
     and completed_at < v_now - interval '24 hours'
     and response_payload is not null;
  get diagnostics scrubbed_count = row_count;

  delete from public.compare_quota_reservations
   where created_at < v_now - interval '30 days';
  get diagnostics deleted_reservations = row_count;

  delete from public.compare_quota_buckets
   where bucket_start < v_now - interval '3 days';
  get diagnostics deleted_buckets = row_count;

  return next;
end;
$;

revoke all on function public.maintain_compare_quota() from public, anon, authenticated;
grant execute on function public.maintain_compare_quota() to service_role;

comment on table public.compare_quota_reservations is
  'Atomic compare reservations; in-progress/abandoned states never repeat paid inference or refund quota. Cached JSON expires after 24h.';
comment on function public.backfill_compare_quota_current_day() is
  'Release-gated local/test cutover helper. Never run against production without approval and verification.';
