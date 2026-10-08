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
- `complete_compare_quota` stores a safe terminal response against the reservation. It never decrements counters. Provider errors therefore consume the reservation because provider cost may be unknown.
- The reservation unique key is `(namespace, subject, idempotency_key)`. A same-fingerprint retry returns the cached response without provider calls; a mismatch is rejected. `/api/compare` and `/api/stream-compare` use `prompt-arena-compare`.
- API routes reserve after body/model authorization and before credential resolution or OpenRouter calls. Missing authority returns 503; quota rejection returns 429 with `Retry-After`.
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

## Residual risks and release tasks

- If `complete_compare_quota` is unavailable after provider work has completed, the reservation can remain `reserved`; the current bounded change does not add a durable retry queue, reconciliation worker, or automatic release. The route may therefore return an error after provider work, and a retry with the same idempotency key cannot safely repeat the provider call. Add and test a forward-only reconciliation path before production cutover.
- No retention or cleanup policy is implemented for `compare_quota_reservations` or historical bucket rows. Define an approved retention period, deletion/archive mechanism, indexes and monitoring before enabling the migration in production.
- The migration does not revoke `CREATE` on schema `public`. Verify the effective schema ACL on the isolated target and production release target through the approved database verification workflow; do not infer this grant state from repository SQL alone.

These are release-gated residual risks, not production verification claims. This branch performs no migration apply, backfill, cloud operation, deployment or production database verification.
