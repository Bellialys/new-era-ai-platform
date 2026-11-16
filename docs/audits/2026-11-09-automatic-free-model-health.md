# New Era AI Platform — automatic free-model health and discovery (MVP)

Date: 2026-11-09

As of 2026-11-16 the scheduled route and journal migration are deployed, but
there are no recorded `model_health_runs` rows yet. LFM 2.5 2.6B remains
public and Stage 7 is still unconfirmed; Stage 10 requires two consecutive
`scheduled` / `succeeded` daily records (17 and 18 November are expected).
Do not claim operational success solely from deployment or job configuration.

## Purpose and limits

Automatically keep the anonymous text catalog usable without hand-editing
Supabase after every OpenRouter free-model retirement, transient outage or
new release.

Production Prompt Arena and Code Arena use Supabase for listing and
validating selections. An empty catalog stays empty. A failed catalog read
returns `503 MODEL_CATALOG_UNAVAILABLE`. The next successful read serves the
live catalog again. `ENABLE_MODEL_HEALTH_CRON` controls scheduled checks.
Development and Preview can use the legacy offline fallback while the flag
is off.

Scheduler: **Vercel Cron daily at 03:17 UTC**, invoking
GET /api/cron/model-health. This is intentionally a once-daily process.
The five-request monitoring budget reserves capacity for interactive traffic.

Per scheduled run:
- up to 3 active free models with one slot reserved for the least-recently
  probed model that has a confirmed first failure and has cleared the cooldown.
  The other slots follow the oldest check date;
- 1 quarantined free model that is explicitly marked for retesting;
- 1 new candidate from the allowlisted providers, or 1 pending new model;
- maximum **5 inference calls per run**; each call is text-only, max 384
  completion tokens and has a 9-second timeout.
- discovery downloads the provider models catalog before inference;
  failure to obtain a valid nonempty catalog aborts without changing models.
- existing records marked with raw_metadata.auto_health_exempt=true are
  protected from the monitor.

## State transitions

- Healthy -> first 404/empty/not-listed: record incident; keep visible.
- Second confirmed hard failure: is_active=false and is_public=false.
- 429, timeout, network failure or generic upstream 5xx:
  inconclusive, not grounds to hide an otherwise working model.
- Two consecutive temporary results for a pending discovery extend its
  cooldown to 40 hours. The discovery slot can check another candidate in
  the intervening daily run.
- Missing or invalid credentials: fail the run; never bulk-disable.
- Quarantined -> first successful nonempty text answer: retain quarantine.
- Quarantined -> second successful answer, at least 20h after previous
  probe: reactivate the same UUID, preserving usage and historical data.
- New candidate -> provider lists ID ending in :free, zero input/output/request
  prices, chat-text output modality, context >=4096, unexpired, allowlisted
  provider -> first successful real inference -> pending nonpublic record.
- Pending -> second real success on a later run -> public/active free.
- New discoveries are added as general-use only, not automatically labeled
  coding capable. Code Arena model capability requires separate review.
- Discovery never automatically enables paid models or changes existing
  prices/billing policy.

All transitions are logged in `models.raw_metadata.auto_health` with
success, failure and temporary-result streaks, last status and check
timestamp. Updates keep the optimistic `updated_at` condition for concurrent
admin changes. Set `auto_health_exempt=true` on a deliberately retired model
to keep it out of scheduled retests.

## Run journal

The job first inserts the UTC date into `public.model_health_runs`. A duplicate
date returns HTTP 200 with `MODEL_HEALTH_ALREADY_RUN` before any OpenRouter
request. Manual calls use the same daily slot. The journal records the
invocation source, start and end times, outcome, and counts for inference,
saved results, hiding, restoration, discovery and first publication.

- No row after the expected window means the job never reserved a run.
  Inspect Vercel for a missed invocation, a disabled schedule or failures
  that prevented journal access.
- `running` beyond the 60-second function limit means the handler could not
  record an outcome. The next date has its own reservation.
- `failed` records the safe error code and any saved progress.
- `succeeded` with zero checks records a valid run without matching work.

The sync has a 46-second time limit and reserves time for the journal.
Apply `20261116104715_model_health_runs.sql` before the scheduled route
starts running this code in production.

## Credentials and activation gate

The route is fail closed. It requires, in the Vercel **Production** environment:

- CRON_SECRET: a newly generated cryptographically random secret, at least
  32 characters long, kept only in Vercel protected environment settings;
  Vercel Cron forwards it as Authorization: Bearer <secret>.
- ENABLE_MODEL_HEALTH_CRON=true: explicit rollout flag. Default is disabled.
- OPENROUTER_API_KEY: the existing platform inference credential.
- NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: existing server-side
  database integration, with service role **never** exposed to the browser.

Never paste secrets in an issue, PR, terminal transcript or chat. To verify
credentials, check presence/permissions, not raw values. Do not enable if the
OpenRouter platform key has insufficient free quota or the budgeted user traffic
needs the entire daily allowance.

The cron route returns only safe numeric counts; it does not return provider
raw responses, customer prompts, API keys, or provider metadata. Calls use a
fixed openrouter.ai destination and a synthetic one-word prompt.

## Pre-release and post-release checks

Before promoting production code:
1. Resolve the existing Next.js security blocker (#136) and run npm audit.
2. Run unit tests, npm run typecheck, npm run lint, npm run build,
   npm run state:check and npm run docs:check.
3. Review the three existing stacked PRs (#137, #138 and this PR) and merge
   in dependency order. Vercel Preview READY is not a substitute for tests.
4. Apply `20261112234626_grant_model_health_catalog_columns.sql` and verify
   the server role can update lifecycle columns and insert pending models.
5. Confirm Vercel Production env and cron secret configuration.
6. Enable the feature flag on a reviewed production release, observe the first
   scheduled run and inspect model metadata / seven working baseline models.
7. Confirm GET /api/models and GET /api/code-models do not expose pending,
   quarantined or nonfree models.

The previous four manual quarantines from 2026-11-09 remain effective until
the job is enabled and successfully obtains **two** separate real answers.
Never auto-switch a retired free ID to its paid version.

## Stage 5 validation (2026-11-13)

- Seven eligible free models in the Preview catalog returned a nonempty live
  response from OpenRouter. Measured request times ranged from 180 to 2196 ms.
  [Verification deployment](https://vercel.com/bellial-s-projects/new-era-ai-platform/CNQfw8tZAyk21KyqwfjFrWb9VSmU)
- In the Preview build, synthetic responses exercised the actual cron and both
  catalog handlers over six simulated days. The checks covered quarantine,
  recovery with the same UUID, discovery after two successes, neutral 429 and
  timeout responses, the five-probe cap, and the cron authorization gate.
- Read-only production inspection found missing catalog write privileges.
  An isolated PostgreSQL test confirmed that the new grants allow pending
  inserts and guarded lifecycle updates. The migration was applied to production on 2026-11-13 (Kyiv time).

## Future stages (not in this MVP)

- Dashboard for run-level and per-model history.
- Account-wide quota telemetry to adjust run budgets dynamically.
- Privacy/region/provider-policy review for new automatically listed providers.
- Admin UI for manual override, model testing, reactivation and alerts.
- Intelligent, optional paid-model onboarding with hard monetary budgets,
  per-user cost gates and explicit operator approval.
- Optional more frequent scheduling after quota review; daily is intentionally
  conservative for free-tier operation.
