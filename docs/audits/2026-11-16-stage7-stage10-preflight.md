# Stage 7 / Stage 10 readiness audit — 2026-11-16

Scope: read-only Supabase production checks and source-code regression coverage. This audit **does not** prove a scheduled Vercel cron invocation happened or that the LFM 2.5 model was automatically hidden. Neither stage is closed.

## Verified runtime and source contracts

- Project: `jbeecpbcsnowcaygteoj` (Supabase production), GitHub `Bellialys/new-era-ai-platform`, Vercel `bellial-s-projects/new-era-ai-platform`.
- Production `public.model_health_runs` exists and has RLS enabled. Read-only query on 16 Nov returned **zero journal rows**. The next expected production cron dates are 17 and 18 November.
- `vercel.json`: `GET /api/cron/model-health`, cron `17 3 * * *` (03:17 UTC; on the Vercel Hobby plan execution may occur anywhere in the 03:00–03:59 UTC hour, 05:00–05:59 in Kyiv during November). Never assume minute-level precision.
- Runtime route authenticates a **server-only** `CRON_SECRET`, requires `ENABLE_MODEL_HEALTH_CRON=true` and an OpenRouter API key, then reserves and finalizes a per-UTC-day journal row. Existence and content of production environment variables could **not** be confirmed: Vercel env metadata request returned HTTP 403.
- The route records `source=scheduled` only when the `x-vercel-cron-schedule` request header is present, as expected from Vercel cron. Manual authenticated calls consume the same daily journal slot and must **not** be used merely to fabricate a scheduled success.
- The code allows 3 active model checks, 1 quarantined check and 1 discovery check per run, with a 46-second synchronization deadline and `maxDuration=60`. A run can legitimately finish `failed` or `running` if a dependency fails or finalization times out.
- Production `liquid/lfm-2.5-2.6b:free` currently has `is_active=true`, `is_public=true`, `auto_health.failure_streak=1`, `last_status=NOT_LISTED`, and `checked_at=2026-11-14T09:18:47.588Z`. The cooldown has elapsed by 17 Nov and `selectHealthTargets()` reserves the first active slot for it.
- Added regression test in `src/lib/server/model-health-sync.test.ts`: with the observed metadata, next-day selection prioritizes LFM, second `NOT_LISTED` hides it, and `RATE_LIMIT` does not. A passing test validates the logic, not the live scheduled run.

## PostgreSQL privilege preflight (read-only)

`has_table_privilege('service_role', 'public.model_health_runs', 'INSERT')` returns `false` because the production migration deliberately uses **column-level INSERT/UPDATE grants**, not table-wide grants. **This does not imply a lack of write privileges.** Do not broaden grants as a workaround.

Correct read-only checks (confirmed `true` for the relevant columns):

```sql
-- Cron claim: only these fields are inserted by the handler.
select has_column_privilege('service_role','public.model_health_runs','run_date','INSERT') as can_claim_date,
       has_column_privilege('service_role','public.model_health_runs','source','INSERT') as can_claim_source,
       has_column_privilege('service_role','public.model_health_runs','started_at','INSERT') as can_claim_start;

-- Cron finalization: every updated column has an explicit grant.
select column_name, privilege_type
from information_schema.column_privileges
where table_schema='public' and table_name='model_health_runs'
  and grantee='service_role' and privilege_type in ('INSERT','UPDATE')
order by privilege_type, column_name;

-- No general client reads of the protected run journal.
select has_table_privilege('anon','public.model_health_runs','SELECT') as anon_read,
       has_table_privilege('authenticated','public.model_health_runs','SELECT') as authenticated_read;
```

Results: claim columns `true`; 11 finalization fields with `UPDATE` and 3 claim fields with `INSERT`; `anon_read=false`, `authenticated_read=false`. Required model-catalog service-role `INSERT`/`UPDATE` column grants also confirmed `true`. No DDL or production data changes performed.

## Actual Stage 7 / Stage 10 release gates

1. On 17 November, **after 05:59 Kyiv**, read `public.model_health_runs`; require a completed `source='scheduled'` and `status='succeeded'`, and inspect `hidden`/ `checked` counts and the current LFM row.
2. For Stage 7, verify `is_active=false`, `is_public=false` for LFM **after an actual cron run**, confirm `GET /api/models` no longer lists its prior UUID, and confirm the server rejects selection of the old UUID. A rate-limited or inconclusive provider response does not satisfy the hide gate.
3. On 18 November repeat the journal check and require two successive calendar dates with `source='scheduled'` and `status='succeeded'`. A `manual`, `failed`, `skipped`, or absent run is insufficient.
4. ChatGPT monitor automations already exist for both stage gates at 06:01 Kyiv. Do not add redundant scheduler invocations, change production model flags manually, or consume a daily journal slot before the scheduled cron.
5. If the journal is empty after the expected window, inspect Vercel Cron Jobs configuration, production environment variable *presence/targets* (not secret values), deployment logs and auth/feature-gate responses using authorized access. No privileged cron request was issued during this audit.

Open issues #147 (AI Team upstream 502 real-traffic verification), #108 (Supabase plan-gated leaked-password protection), and #100 (predeployment Vercel quota gate) are independent from the health-run evidence gate.
