-- Release-gated POST-MIGRATION operation. NOT a Supabase migration.
-- DO NOT execute on production until quota RPCs are live, the rollout is
-- approved, the pg_cron extension is separately enabled by a DB admin,
-- and the isolated SQL/parallel tests have succeeded.
--
-- Idempotent by job name. This script does not grant broader SQL privileges.
-- Run using the database administrator in the SQL editor only after release
-- approval; the job executes the SECURITY DEFINER cleanup function.
do $gate$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'pg_cron must be enabled explicitly before quota maintenance rollout';
  end if;
  if to_regprocedure('public.maintain_compare_quota()') is null then
    raise exception 'quota cleanup RPC missing: apply and verify the quota migration first';
  end if;
  if to_regclass('public.compare_quota_reservations') is null then
    raise exception 'quota reservation table missing';
  end if;
end;
$gate$;

-- 04:25 UTC. The same job name replaces the old schedule if rerun.
-- Supabase Cron uses pg_cron and records executions in cron.job_run_details.
select cron.schedule(
  'new-era-compare-quota-maintenance',
  '25 4 * * *',
  'select * from public.maintain_compare_quota()'
);

-- Verify the job was created. Do not confuse this with proof that it ran.
select jobid, jobname, schedule, command, active
from cron.job where jobname = 'new-era-compare-quota-maintenance';

-- After the first execution, inspect actual success/failure and runtime:
-- select runid, status, start_time, end_time, return_message
-- from cron.job_run_details
-- where jobid = (select jobid from cron.job where jobname = 'new-era-compare-quota-maintenance')
-- order by start_time desc limit 10;
