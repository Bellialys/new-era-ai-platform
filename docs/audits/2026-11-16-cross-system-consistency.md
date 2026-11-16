# Cross-system documentation and release-state audit — 2026-11-16

## Scope and evidence

- Canonical source: `Bellialys/new-era-ai-platform` public GitHub repository, `main` commit `a9e795d2b895901eb0ac27a05fcd15d0f166dcbc` after PR #145.
- GitHub recursive tree enumeration: 540 entries, no truncation. This is a **repository inventory**, not a claim of line-by-line manual review of every source file. Semantically reviewed the key release, model, database, status and documentation-sync files.
- [GitHub Actions #43873426310](https://github.com/Bellialys/new-era-ai-platform/actions/runs/43873426310): completed/success for the merge commit. Security issue #136 closed after verified Next.js fix and blocking audit.
- Vercel production returned HTTP 200 for `/api/health`, `/api/models` and `/api/code-models`. `/api/health` JSON is `{"status":"ok"}` without a nested database health field.
- Production Supabase project `jbeecpbcsnowcaygteoj` was ACTIVE_HEALTHY. Query: 8 active/public free models and 3 coding; LFM 2.5 2.6B remains public. Security Advisor: leaked password protection disabled (issue #108) and informational RLS-without-policy for `model_health_runs`.
- Vercel cron `17 3 * * *` is configured. Supabase `model_health_runs` exists but was empty on 16 Nov. Do not infer scheduled execution from a successful deployment. Stage 7 and Stage 10 are pending proof.
- [GitHub Actions failed OpenRouter catalog verification #43856492433](https://github.com/Bellialys/new-era-ai-platform/actions/runs/43856492433) predates merged PR #145 and reported precisely the three now-removed stale free IDs. A post-merge nightly/manual catalog verification is still required as a distinct gate.
- Production Supabase migration history includes `20261109095503_lab05_saved_prompts`; the SQL file is in draft PR #135, not yet on `main`. This is a **reproducibility gap**. Do not run applied migrations twice or merge draft Lab05 without E2E/auth/release validation.
- Google Drive searches for `New Era AI`, `Новая эпоха`, and `new-era-ai-platform` yielded no matching project documents in the connected account. Therefore no Google Drive files were modified or claimed to be synchronized; unrelated similarly named materials were left untouched.

## Later reconciliation (2026-11-16)

The exact Lab05 SQL migration file was restored to `main` from draft PR #135; production's schema had already been verified and **no SQL was re-executed**. `20260929022500_stage34_atomic_openrouter_activation` exists only locally and must remain unapplied until the Stage 3.2 live activation gate is approved. The findings above reflect the state before reconciliation.

## Corrections in this documentation-only change

- `PROJECT-CONTEXT.md`, `README.md`, `14-roadmap.md`, `15-changelog.md`: dated operational baseline and preservation of historical Stage 3 notes and version markers.
- `08-database.md`: corrected production fail-closed model-resolution behavior and remote-vs-main migration exception.
- `11-ai-models.md`, `32-model-catalog-governance.md`: historical 11-model snapshot explicitly marked as historical; current counts clarified.
- `docs/audits/2026-11-09-automatic-free-model-health.md`: Stage 7/10 run evidence not yet complete.
- `docs/runbook.md`, `docs/release-checklist.md`: correct API health fields, security/CI checks, Supabase and cron evidence requirements.

## Known remaining tasks and boundaries

1. Wait for scheduled production cron evidence for 17–18 November, then verify two `scheduled/succeeded` daily entries before completing Stage 10; verify model auto-hide and legacy UUID rejection for Stage 7.
2. Re-run `models:verify -- --public-catalog --json` on the latest `main` through an approved GitHub Actions dispatch (or the next schedule); do not treat pre-merge failures as post-merge test results.
3. Reconcile the applied Lab05 migration into the repository in a release-safe branch/PR. Keep #135 draft and avoid reapplying the SQL.
4. Plan separate fixes for #108 (Supabase leaked password protection, may be plan-gated) and #100 (prevent unnecessary Vercel deployment creation).
5. `docs:check` and `state:check` test machine-readable version/marker consistency, **not semantic truth** of every prose paragraph. Periodically compare against live APIs and migrations.
6. Historical archive, old architecture and future-roadmap drafts were intentionally not rewritten to imitate live production. Only verified present-tense descriptions in canonical documents were corrected.

No secrets, API keys, user records, production DB writes, or runtime feature flags are included in this audit.
