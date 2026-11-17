# ADR-008: Atomic daily quota reservation and compare idempotency

**Status:** Proposed (Issue #168; implementation and PostgreSQL integration tests pending)
**Date:** 2026-11-17
**Scope:** Prompt Arena `POST /api/compare` (JSON + SSE) and `POST /api/stream-compare`
**Base:** `main` at `790ac78ebec2534f5d4044bdc086badfb41e7337`; PR #167 is not merged
**References:** [Issue #168](https://github.com/Bellialys/new-era-ai-platform/issues/168), [PR #167](https://github.com/Bellialys/new-era-ai-platform/pull/167), `src/lib/server/usage-limits.ts`, `src/lib/server/arena-persistence.ts`

## Context and verified baseline

- `checkDailyLimit` currently counts rows in `public.tasks` since UTC midnight before calling a provider. The check and subsequent task insert are not in one transaction. Concurrent requests can both pass at the last remaining slot; a retry can duplicate provider calls.
- `saveArenaRun` inserts `tasks` and `model_responses` in separate calls. A partial persistence failure can leave an orphan task, and a retry has no stable run identifier.
- Live production schema was inspected **read-only** on 2026-11-17: `public.tasks` and `public.model_responses` exist with RLS enabled; neither has a compare reservation identifier. No DDL was run.
- `main` still has an additional fail-open path in `getDailyUsage` (Supabase unavailable/query count null => zero). The PR #167 fix must be merged or rebased before implementing and enabling this feature. A read-only quota check, even when fail-closed, is not a concurrency control.
- The existing daily request quota is `anonymous=5 / free=20 / pro=100 / admin=9999` in UTC; it is *not* a financial cap or provider-token budget.

## Decision

Introduce one PostgreSQL authority for **reserve / mark-provider-started / finalize / release** with explicit idempotency ownership, guarded by an owner-and-UTC-day row lock. The OpenRouter call is **never** performed unless a durable reservation succeeds and the execution lease is still valid. Keep the existing JSON/SSE response bodies stable wherever possible.

### Proposed storage (forward-only migration; not applied)

1. `public.compare_quota_days`: `owner_kind` (`user`|`guest`), server-verified `owner_key`, `quota_day_utc`, reserved/charged counters and timestamps; unique (`owner_kind`, `owner_key`, `quota_day_utc`). Lock this row with `SELECT ... FOR UPDATE` during each quota mutation. Never rely on per-process locks or independent count-then-insert statements.
2. `public.compare_reservations`: immutable `owner_kind`, `owner_key`, `idempotency_key`, `request_fingerprint`, `quota_day_utc`, `reservation_id`, `lease_token`, `state`, `task_id`, `created_at`, `updated_at`, `expires_at`; unique (`owner_kind`, `owner_key`, `idempotency_key`) **across both compare endpoints**. The fingerprint covers normalized prompt, ordered model IDs, mode, blind and streaming flags/route; only SHA-256 digest is persisted, not raw prompt.
3. `public.tasks` gains an optional unique `compare_reservation_id` foreign key for exact task-to-reservation linkage. Existing records remain valid.
4. Functions are callable only by the trusted server's `service_role` (not `PUBLIC`, `anon`, `authenticated`); prefer `SECURITY INVOKER` with explicitly schema-qualified objects and a fixed `search_path`. Avoid making an unrestricted `SECURITY DEFINER` RPC public. All new public tables have RLS enabled and direct client grants removed.
5. UTC-day migration cutover must account for already persisted `tasks` from earlier in the same day, with a deterministic once-only backfill or a transactionally safe legacy-count reconciliation. Otherwise deployment mid-day would effectively reset quotas. During rollout, mixed old/new app versions must not admit unreserved provider calls; enable the strict route only after the old instances are drained or roll out behind a checked gate.

### Transaction and execution protocol

1. Validate server-side identity, prompt and model access **first**; calculate the canonical request fingerprint. Client supplies a fresh UUID `Idempotency-Key` per user action and reuses it for retries; request body does not change. For compatibility, when absent the server generates a fresh one, but cannot deduplicate a later retry that lacks the original key. Validate maximum size and format; reject malformed keys.
2. `reserve_compare_quota` atomically looks up the key under its verified owner. Existing same-key + different fingerprint => `409 IDEMPOTENCY_CONFLICT`; same-key in progress => `409 REQUEST_IN_PROGRESS` with `Retry-After`; same-key completed => replay from the existing persisted run without another OpenRouter request. Do not trust owner ID, quota or plan from the client.
3. For a new key, lock its owner's UTC-day quota row, evaluate **charged + active reservations + legacy usage**, and either reserve exactly one request or reject with `429 DAILY_LIMIT_EXCEEDED`. Do not send OpenRouter requests on database/RPC failure (controlled 503; fail closed).
4. Immediately before the first outbound provider request, use a compare-and-swap `mark_provider_started(reservation_id, lease_token)`. An expired/released lease cannot become provider-started. Once outbound work may have started, the quota slot remains charged even if the provider times out, the app crashes, or persistence fails. This conservative rule avoids accidental double use of a quota slot; it does not prove provider billing.
5. Finalize `tasks`, `model_responses` and the reservation status **in one database transaction/RPC**. If finalization is retried with the same reservation, return the original task and response IDs; never insert another task or double-finalize. Record an explicit uncertain state on persistence/transport errors; never blindly retry the OpenRouter call.
6. Release only a reserved-but-never-dispatched slot, exactly once, with a guarded state transition and matching lease token. Reap expired pre-dispatch reservations with fencing; do not auto-release `provider_started` / `uncertain` requests. Quota reconciler reports anomalies rather than mutating monetary ledger or silently erasing charged records.
7. Preserve the UTC date captured at reservation time, including requests that finish after UTC midnight. Store idempotency outcomes at least 48 hours; charge/counter records must survive UTC rollover and reconciliation. Retention/cleanup requires its own tested job and must not delete active leases.

### HTTP/SSE compatibility and client responsibilities

- Preserve successful JSON response fields and SSE event names. A completed retry should replay the persisted result from the same verified owner; SSE should emit a compatible terminal sequence without a second provider call. No blind-mode model identity disclosure on replay.
- Expose `Idempotency-Key` as an optional request header; keep body backward-compatible. Client must store a key for one submission and reuse it on transport retries, creating a **new** key only for an intentionally new run.
- Explicit controlled failures: `429 DAILY_LIMIT_EXCEEDED` (Retry-After until next UTC day, not a fixed 86400 unless exact), `409 IDEMPOTENCY_CONFLICT`, `409 REQUEST_IN_PROGRESS`, `503` for a failed quota authority, and an ownership-safe response for missing/expired operations.
- `GET /api/usage` and quota UX must be aligned with the authoritative ledger. Do not display the old `tasks` count as if it were the new reservation count.
- Apply consistently to both compare routes and the `stream=true` branch. Other AI endpoints still using independent quota semantics are a separate rollout scope and must not be portrayed as protected.

## Required regression and security gates

| Test | Expected invariant |
|---|---|
| Two different keys at the last quota slot, simultaneous DB transactions | Exactly one obtains a reservation; the other 429; max one provider dispatch |
| Same key, same request, simultaneous retries | One reservation/one dispatch; other is in-progress or replay |
| Same key, changed body, same owner | 409 conflict, no dispatch |
| Same key used by another user or guest | No access to previous response; independently scoped key |
| Guest cookie spoof/rotation, user promotion | Verified owner only; no cross-identity replay |
| Crash before provider-start CAS | Expired lease can be released; old token can never dispatch |
| Timeout/crash after provider-start CAS | Quota not released automatically; no duplicate provider request |
| Task insertion succeeds but response save fails | Atomic transaction rolls back all task/response writes; reservation remains chargeable and reconciliable |
| Replay after successful finalization | Exact same task and response IDs; no second provider call |
| UTC midnight rollover, tier change and mid-day rollout | Correct day/plan, no quota reset or double count |
| Supabase unavailable, null count, RPC error | No OpenRouter call; controlled error |
| SSE, JSON, blind SSE | Existing contract preserved, no identity leaks |
| Anonymous/auth attempts to call new RPC/tables | Permission denied, RLS intact |
| Retention cleanup vs slow worker | Lease fencing prevents stale dispatch or accidental double release |

Use **isolated PostgreSQL** concurrency tests (separate connections/processes, not Vitest mocks alone), then run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run state:check`, `npm run docs:check` and Supabase advisors. Inspect migration history and GitHub CI. No success status without evidence.

## Rollout and recovery

1. Finish and merge/rebase PR #167 quota fail-closed hardening; review existing callsites and baseline test contract.
2. Prepare versioned forward-only migration + RPC in a feature branch; validate only against isolated PostgreSQL. **Do not apply to production during this work.**
3. Implement server orchestration, persistence, owner-scoped replay, client key reuse, and tests in small commits. Ensure schema and code deploys are backward-compatible; no unreserved provider execution during transition.
4. Apply migration only in an authorized controlled release, then gate enabling on successful smoke/concurrency checks in Preview, and deploy a monitored production canary after the Stage 10 scheduled cron acceptance. Verify new task history, quotas, streaming, external provider cost and error rates.
5. Roll back via a safe feature switch to the prior known-good path only if its quota risk is explicitly accepted and provider spending is disabled/limited; otherwise fail closed. Prefer forward fix over destructive schema rollback. **Never drop reservation records to "reset" a failing rollout.**

## Boundaries, alternatives and residual risk

- Rejected: Redis-only counter (not transactionally coupled to task persistence); local mutex (cross-instance race); count-then-insert; unconditional TTL release after provider dispatch; request-hash alone as idempotency key (two intentional identical submissions must be distinct).
- Not part of this ADR: OpenRouter monetary budgets, provider-level exactly-once charging, all API endpoints, migration execution in production, new paid-user features.
- Exactly-once OpenRouter billing cannot be promised without provider cooperation; our guarantee is at-most-one **app-controlled dispatch per owner/key** and at-most-one **daily quota reservation** per request, given the checked database boundary.
- Current state: **design only**, no feature implementation, no local/CI/PostgreSQL test claims, no production changes.
