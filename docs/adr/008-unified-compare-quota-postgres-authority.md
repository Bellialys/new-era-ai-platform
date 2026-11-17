# ADR 008: Unified Compare Quota PostgreSQL Authority

## Context

`POST /api/compare` and `POST /api/stream-compare` previously used different controls: an in-memory/optional Redis minute limiter and a legacy `tasks` count for daily usage. Those checks were not one atomic reservation, did not share a namespace, and could admit concurrent requests beyond policy. Provider credential resolution also had to remain after quota rejection.

The policy is one logical comparison unit per accepted request, independent of selecting 2-5 models: guest 5/day and 5/minute; free 20/day and 10/minute; pro 100/day and 10/minute; admin 9999/day and 10/minute; UTC reset boundaries.

## Options considered

1. **Redis daily plus Redis minute counters.** Fast, but split authority creates multi-key atomicity and recovery problems, and makes legacy-task cutover harder to prove.
2. **Application read/check/write against `tasks`.** Compatible with existing history, but has a TOCTOU race across serverless instances and cannot safely reserve before provider work.
3. **One PostgreSQL RPC/transaction.** A single transactional authority can lock the identity, day bucket, minute bucket and idempotency record together, while keeping `tasks` unchanged for history/voting.

## Decision

Use service-role-only PostgreSQL `SECURITY DEFINER` RPCs with a fixed `search_path = pg_catalog, public`:

- `reserve_compare_quota` resolves the user role/plan from trusted `profiles` data, derives the subject from server-resolved user/guest identity, locks the subject with `pg_advisory_xact_lock`, locks UTC buckets, checks both limits, and increments both counters atomically.
- `complete_compare_quota` stores a terminal response against the reservation. It is **idempotent for an exactly identical second completion**, allowing a bounded POST RPC retry if an acknowledgement is lost. A mismatched, unknown or abandoned completion raises a controlled error. It never decrements counters. Provider errors therefore consume the reservation because provider cost may be unknown.
- The reservation unique key is `(namespace, subject, idempotency_key)`. A same-fingerprint retry returns the cached response **only after completion**. While pending, the result is `in_progress` → 409 `COMPARE_IN_PROGRESS` + `Retry-After: 5`; an abandoned or scrubbed result becomes `result_expired` → 409 `IDEMPOTENCY_RESULT_UNAVAILABLE`. A mismatch rejects the key. None of these states starts another provider call. `/api/compare` and `/api/stream-compare` share `prompt-arena-compare`.
- API routes reserve after body/model authorization and before credential resolution or OpenRouter calls. Missing authority returns 503; quota rejection returns 429 with `Retry-After`; in-progress replay returns 409 with `Retry-After`; stale replay returns 409. Client attaches an opaque idempotency key per logical submission and retains it across transport retry.
- RLS is enabled and direct table grants are revoked. Only `service_role` receives function execute grants; clients cannot provide plan, limit or trusted identity.

## Backfill and cutover

Migration `20261008090000_unified_compare_quota_hardening.sql` includes the service-role-only `backfill_compare_quota_current_day()` support function. During an approved local/test or production release operation, it counts current-UTC-day legacy `tasks` per user/guest and uses `GREATEST(existing, legacy_count)`, so already-reserved usage is never reset. The function must not be run against production from this branch.

Recommended release sequence: apply the forward-only migration, verify grants/RLS/function definitions, run a bounded read-only count comparison, run the approved backfill, canary both routes with synthetic identities, then enable route cutover. Keep the legacy `tasks` writes for history/voting. No production backfill or flag activation is part of this change.

## Rollback and forward-fix

Do not roll back by dropping quota tables or decrementing usage. Disable route cutover only through an approved forward fix, preserving reservations and auditability. If a defect is found, ship a forward migration/RPC fix, reconcile bucket counts against reservations and legacy tasks, and keep the highest observed usage. Idempotency records are retained for replay protection.

## Security review

The RPCs are `SECURITY DEFINER` with a fixed search path, explicit public/anon/authenticated revokes and service-role-only execute grants. Plan and role are read from `profiles`, not request data. Advisory locking removes the cross-instance TOCTOU window. Fingerprint mismatch prevents replay under a reused key. Retry-after is computed from UTC bucket boundaries. No quota rejection reaches the credential resolver or provider gateway.

## Verification

Unit and route regression tests cover identity/plan matrix through RPC parameters, shared helper usage, one unit for 2-5 models, reject ordering, Retry-After, authority failure, replay and fingerprint mismatch. SQL execution is release-gated and must use an isolated local/test database only; no remote production migration or backfill is performed by this branch.

## Updated audit — 2026-11-16 (draft, test-only)

- Confirmed current production Supabase has **no** `compare_quota_buckets` or `compare_quota_reservations` table and no `reserve_compare_quota` RPC. This PR is **not live**, and must not be merged or applied to production without a controlled release gate.
- Found and corrected a backfill overcounting bug: production `public.tasks` contains Prompt Arena, Code Arena and AI Team records. The backfill previously counted *all* modes in the `prompt-arena-compare` namespace, which could consume a user's Prompt Arena quota for unrelated activity. It now explicitly filters `mode_slug = 'prompt-arena'`; a migration-source regression test enforces this.
- Verified the live `profiles` table has `role` and `plan` columns with constrained values (`user/admin`, `free/pro`). No production data was modified.
- No Supabase development branch currently exists. A request to create `test-compare-quota-20261116` was rejected because a cost confirmation ID is required. **No billable branch or production mutation occurred.** PostgreSQL/parallel-execution tests still require an isolated, explicitly approved database. The local container has no PostgreSQL binaries and cannot fetch packages from the network.
- Production schema ACL read-only check returned `has_schema_privilege('authenticated','public','CREATE')=false`, `anon=false`, `service_role=false` on 16 Nov. That verifies the current **production** target only; the isolated migration test target must be checked independently after setup.
- Added non-billing recovery semantics and privacy retention **in un-applied migration code**: stale `reserved` records become `abandoned` after 15 minutes; same key never repeats inference or refunds quota. Completion RPC retries at most once, accepting an exact already-committed completion. New service-role-only `maintain_compare_quota()` marks stale reservations and scrubs cached JSON after **24 hours**, prunes reservation metadata after **30 days**, and old counters after **3 days**.
- Fixed a separate critical contract bug: the reserve RPC legitimately returns `reservation_id=NULL` for `quota_exceeded`; the old TS parser rejected it as an authority error (503). Parser now supports NULL IDs for failure outcomes and returns true quota 429. Tests use the real NULL-ID result.
- Added a transactional **test file** `supabase/tests/compare_quota_reconciliation.sql` (rolls back fixture rows) for use against an isolated Supabase-like database. It has not been executed yet, and cannot prove real concurrency without a second parallel-connection test.
- **Remaining blockers:** scheduled invocation/monitoring of `maintain_compare_quota()` is not yet wired; isolated PostgreSQL tests for concurrency, RLS/RPC grants, migration ordering, ACL, and both compare routes have not run. These remain release blockers.
- Maintain the stacked PR base on `feat/copilot-agent-hierarchy` until the agent-profiles PR #133 and its manual security gates have been addressed; updating `main` directly must not activate this code. No production migration/backfill/cutover is authorized by this audit.

## Real PostgreSQL test evidence — 2026-11-16

- Corrected a release-blocking SQL syntax error: two draft functions had invalid `AS $ ... $;` delimiters instead of PostgreSQL `AS $ ... $;`. Added a static regression assertion in `src/lib/server/compare-quota.test.ts` to catch unbalanced dollar-quoted function bodies.
- Created a **no-cost-to-Supabase** real PostgreSQL 17 test via ephemeral GitHub Actions service. CI-only [PR #156](https://github.com/Bellialys/new-era-ai-platform/pull/156) successfully applied the forward-only draft migration to an **isolated CI database**, executed transactional RPC/replay/retention/ACL fixtures, and tested 12 concurrent reservations on the same guest: **5 accepted, 7 quota_exceeded**; both UTC counters = 5. [SQL CI run #43896057077](https://github.com/Bellialys/new-era-ai-platform/actions/runs/43896057077) completed SUCCESS, as did [app CI run #43896057083](https://github.com/Bellialys/new-era-ai-platform/actions/runs/43896057083) (security, TS, lint, unit tests, build, docs and smoke).
- [PR #157](https://github.com/Bellialys/new-era-ai-platform/pull/157) added a path-scoped **PostgreSQL CI gate** to `main`. With the migration absent in current `main`, the SQL steps are explicitly skipped; any future PR that introduces quota SQL must run them. **No quota migration or feature code was merged.**
- Added `supabase/operations/activate_compare_quota_maintenance.sql`, an **explicit release-gated** script (not in `supabase/migrations`) that checks `pg_cron` and quota RPC availability and registers a daily 04:25 UTC cleanup job. It was **not executed**. Current production has `pg_cron` available but **not installed**, confirmed read-only; enabling the module, configuring its job, and monitoring `cron.job_run_details` must be separately approved after release.
- GitHub's minimal CI fixture is Supabase-like, not an exact full production schema/roles/extension clone. Full Supabase development integration, production-compatible rollout, monitoring and a permission/plan review remain gated. No production SQL, real user data, paid Supabase branch, model inference or quota cutover occurred.

## Residual risks and release tasks

- If `complete_compare_quota` is unavailable after provider work, the route attempts **one bounded RPC retry**; if the outage persists, the cached answer may still be lost. An identical request returns 409 while in progress, then 409 `IDEMPOTENCY_RESULT_UNAVAILABLE` after 15 minutes (without a second paid inference or an automatic refund). `maintain_compare_quota()` also fences stale records. This **cannot reconstruct a lost provider answer**; the user must explicitly start a fresh logical request with a different idempotency key. Schedule and test maintenance before release.
- Draft privacy-retention SQL scrubs full terminal JSON after 24 hours, prunes reservation metadata after 30 days, and cleans counter buckets older than 3 days. Until a controlled schedule invokes the service-role-only maintenance function, these rules are **defined but not operational**. Validate volume, VACUUM/autovacuum impact, monitoring and run the transactional fixture before release.
- Production read-only check confirmed `CREATE` on schema `public` is false for `anon`, `authenticated`, and `service_role`. Repeat the check on isolated test target after applying the migration; the SQL does not change existing schema ACL.

These are release-gated residual risks, not production verification claims. The isolated PostgreSQL 17 test and blocking app CI now pass, but the production rollout, installation and operational success of pg_cron, schema parity, model cost/replay policy and approval remain outstanding. No production migration or backfill was applied; only read-only production checks and a rejected paid branch-creation attempt occurred. Keep PR #134 Draft until these release gates are satisfied.

## Addendum — 2026-11-17: explicit key and response-format isolation

- The parser now rejects an explicit malformed `Idempotency-Key` with `400 INVALID_IDEMPOTENCY_KEY`; a missing key alone triggers server UUID generation for legacy compatibility. Previously a malformed key was silently replaced, allowing a retry to start a new paid inference instead of being recognized as a duplicate.
- The canonical SHA-256 fingerprint includes transport type (`compare-json`, `compare-sse`, `stream-compare-sse`) in addition to prompt/model/mode/blind inputs. This prevents returning a stored JSON response as an SSE event (or the reverse) when the same owner and key are reused across routes.
- Added Vitest invariants for three response transports, malformed explicit headers, missing keys and no RPC call on invalid keys.
- **Outstanding design limitation:** persistence of `tasks` and `model_responses` is still separate from the quota completion RPC. A crash or partial save failure may leave an inconsistent history while quota stays charged. Do not claim transactional exactly-once task persistence or guaranteed provider billing exactly-once until an additional atomic persistence design and integration test are approved. See Issue #168.
- This is Draft-only hardening; does not modify production migration, the live database, or release restrictions in Issue #160.
