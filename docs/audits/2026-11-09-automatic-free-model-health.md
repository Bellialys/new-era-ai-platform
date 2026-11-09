# New Era AI Platform — automatic free-model health and discovery (MVP)

Date: 2026-11-09  
State: implementation on feature branch; NOT active in production until reviewed/merged and manually enabled.

## Purpose and limits

Automatically keep the anonymous text catalog usable without hand-editing
Supabase after every OpenRouter free-model retirement, transient outage or
new release. The existing public API routes remain unchanged.

Scheduler: **Vercel Cron daily at 03:17 UTC**, invoking
GET /api/cron/model-health. This is intentionally a once-daily process.
According to OpenRouter's free-tier documentation, most accounts receive
50 free requests/day, failed attempts included; a 5-request monitoring budget
limits monitoring to 10% of that base allowance before user traffic.

Per scheduled run:
- 3 least-recently-probed active free models;
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

All transitions are logged in models.raw_metadata.auto_health with
success/failure streaks, last status and check timestamp, and use
optimistic updated_at checks to avoid overwriting concurrent admin changes.
This is an MVP with best-effort concurrency control, not a global distributed
lock. If the operator explicitly retires a model, mark it exempt or remove
verification_retest_required so the scheduler does not revive it.

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
4. Confirm Vercel Production env and cron secret configuration.
5. Enable the feature flag on a reviewed production release, observe the first
   scheduled run and inspect model metadata / seven working baseline models.
6. Confirm GET /api/models and GET /api/code-models do not expose pending,
   quarantined or nonfree models.

The previous four manual quarantines from 2026-11-09 remain effective until
the job is enabled and successfully obtains **two** separate real answers.
Never auto-switch a retired free ID to its paid version.

## Future stages (not in this MVP)

- Centralized distributed lock and dedicated health-events audit table
  for concurrent invocations and a persistent dashboard.
- Account-wide quota telemetry to adjust run budgets dynamically.
- Privacy/region/provider-policy review for new automatically listed providers.
- Admin UI for manual override, model testing, reactivation and alerts.
- Intelligent, optional paid-model onboarding with hard monetary budgets,
  per-user cost gates and explicit operator approval.
- Optional more frequent scheduling after quota review; daily is intentionally
  conservative for free-tier operation.
