-- Isolated PostgreSQL transactional verification for PR #134.
-- Run only AFTER the draft migration on a disposable test database:
--   psql "$TEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/tests/compare_quota_reconciliation.sql
-- Never run on production; the whole fixture rolls back test rows.
-- This is a real DB executable test, NOT proof until successfully executed.
begin;

do $$
declare
  v_guest text := 'quota-fixture-' || gen_random_uuid()::text;
  v_first uuid;
  v_orphan uuid;
  v_outcome text;
  v_payload jsonb;
  v_retry integer;
  v_units bigint;
  v_scrubbed bigint;
  v_rejected boolean := false;
begin
  if not has_function_privilege('service_role','public.reserve_compare_quota(uuid,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role','public.complete_compare_quota(uuid,jsonb,integer)','EXECUTE')
     or not has_function_privilege('service_role','public.maintain_compare_quota()','EXECUTE') then
    raise exception 'service_role lacks one or more quota RPC EXECUTE grants';
  end if;
  if has_function_privilege('anon','public.reserve_compare_quota(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('authenticated','public.reserve_compare_quota(uuid,text,text,text)','EXECUTE')
     or has_function_privilege('anon','public.maintain_compare_quota()','EXECUTE')
     or has_function_privilege('authenticated','public.maintain_compare_quota()','EXECUTE') then
    raise exception 'untrusted roles must not EXECUTE privileged quota RPCs';
  end if;
  if has_table_privilege('anon','public.compare_quota_reservations','SELECT')
     or has_table_privilege('authenticated','public.compare_quota_buckets','SELECT') then
    raise exception 'direct reads of private quota tables are forbidden';
  end if;

  select outcome, reservation_id into v_outcome, v_first
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-one', 'fingerprint-one');
  if v_outcome is distinct from 'accepted' or v_first is null then
    raise exception 'expected first accepted reservation, got %', v_outcome;
  end if;

  select outcome, retry_after_seconds into v_outcome, v_retry
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-one', 'fingerprint-one');
  if v_outcome is distinct from 'in_progress' or v_retry < 1 then
    raise exception 'incomplete reservation must not start a second inference';
  end if;

  select outcome into v_outcome
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-one', 'different-fingerprint');
  if v_outcome is distinct from 'idempotency_mismatch' then
    raise exception 'same key with a changed request must be rejected';
  end if;

  perform public.complete_compare_quota(v_first, '{"status":"success","answer":"fixture"}'::jsonb, 200);
  -- Exact duplicate completion: a lost HTTP acknowledgement is recoverable.
  perform public.complete_compare_quota(v_first, '{"answer":"fixture","status":"success"}'::jsonb, 200);

  begin
    perform public.complete_compare_quota(v_first, '{"status":"changed"}'::jsonb, 200);
  exception when sqlstate 'P0001' then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'different second completion must be rejected';
  end if;

  select outcome, response_payload into v_outcome, v_payload
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-one', 'fingerprint-one');
  if v_outcome is distinct from 'replayed'
     or v_payload is distinct from '{"status":"success","answer":"fixture"}'::jsonb then
    raise exception 'completed compare must return its exact cached result';
  end if;

  select outcome, reservation_id into v_outcome, v_orphan
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-two', 'fingerprint-two');
  if v_outcome is distinct from 'accepted' or v_orphan is null then
    raise exception 'second independent reservation should be accepted';
  end if;
  -- Simulate a crash long after the function's request deadline.
  update public.compare_quota_reservations
     set created_at = clock_timestamp() - interval '16 minutes'
   where id = v_orphan;

  select outcome into v_outcome
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-two', 'fingerprint-two');
  if v_outcome is distinct from 'result_expired' then
    raise exception 'stale reservation must be fenced, not replayed';
  end if;
  if (select status from public.compare_quota_reservations where id=v_orphan) <> 'abandoned' then
    raise exception 'stale reservation must be marked abandoned';
  end if;

  select units into v_units
    from public.compare_quota_buckets
   where namespace = 'prompt-arena-compare'
     and subject_key = 'guest:' || v_guest
     and bucket_kind = 'day';
  if v_units <> 2 then
    raise exception 'both accepted reservations must remain charged, got %', v_units;
  end if;

  -- Simulate data reaching the privacy-retention threshold.
  update public.compare_quota_reservations
     set completed_at = clock_timestamp() - interval '25 hours'
   where id = v_first;
  select scrubbed_count into v_scrubbed from public.maintain_compare_quota();
  if v_scrubbed < 1 then
    raise exception 'maintenance must scrub terminal JSON after 24 hours';
  end if;

  select outcome into v_outcome
    from public.reserve_compare_quota(null::uuid, v_guest, 'request-one', 'fingerprint-one');
  if v_outcome is distinct from 'result_expired' then
    raise exception 'scrubbed result must never trigger a second paid inference';
  end if;
  if (select units from public.compare_quota_buckets
      where namespace='prompt-arena-compare'
        and subject_key='guest:' || v_guest
        and bucket_kind='day') <> 2 then
    raise exception 'cleanup must not refund already consumed quota';
  end if;

  raise notice 'PASS: pending/replay/mismatch/stale/retention/grants; rolled back';
end;
$$;

rollback;
