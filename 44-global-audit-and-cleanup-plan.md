# 44 - Global Audit and Cleanup Plan (v2.0.0-alpha.1)

Project: **New Era AI Platform / Новая эпоха**
Audit date: **2026-07-02**
Repository phase: `v2.0 - AI Team Mode`
Repository version: `v2.0.0-alpha.1`
Status: **ready for execution after live Step 0 verification**

This document records the accepted cleanup plan for the live repository after
Step 0 confirmed that document number `43` is occupied by
`43-web-dev-skills-roadmap.md` and this plan must use number `44`. The cleanup
is tracked by `.project/tasks/V200-04.json`.

## Baseline

The source audit was performed against a 2026-06-28 repository snapshot. The
live 2026-07-02 repository was rechecked before execution.

Verified baseline after the owner-approved WIP commit:

```text
npm run typecheck    PASS
npm run lint         PASS
npm test             PASS, 337/337
npm run test:env-check PASS
npm run build        PASS
npm run docs:check   PASS
npm run state:check  PASS
```

Live checks that still require real environment access remain outside this PR:

- `npm run models:verify` requires `OPENROUTER_API_KEY`;
- `npm run schema:check` requires `SUPABASE_DB_URL`;
- `env:check:full` requires live Supabase/Vercel variables;
- production Team Mode smoke requires Vercel env activation and redeploy;
- git tag `v2.0.0-alpha.1`, Upstash env, and Storage bucket `images` must be
  confirmed by the owner in live systems.

## Findings

### F-01. Register `42-v2-ai-team-mode-plan.md`

`42-v2-ai-team-mode-plan.md` exists and is current, but was absent from
`.project/document-map.json -> activeDocuments`.

Resolution: add it to `activeDocuments`. Do not add it to `syncedDocuments`
because it has no SYNC markers.

### F-02. Status header in 42

Live Step 0 showed this is already fixed in substance. The file no longer says
that Team Mode is only planning work. Resolution: mark as `SKIPPED`.

### F-03. Move stale root audit

`file-connection-audit.md` is a historical 2026-06-15 report and does not
belong in the root numbered-document layer.

Resolution: move it to `docs/audits/file-connection-audit-2026-06-15.md`.

### F-04. Move one-off PowerShell script

`29-apply-documentation-audit-fixes.ps1` is a one-off applied script and
collides numerically with active document `29-database-ownership.md`.

Resolution: move it to `archive/29-apply-documentation-audit-fixes.ps1`.

### F-05. Normalize numbered document canon

Decision D-1: **Variant A**. Numbered active documents live in the repository
root. The `docs/` directory is for unnumbered operational documents and
`docs/audits/` is for dated audit reports.

Resolution:

- move env-check policy document 37 from `docs/` to `37-env-check-policy.md`;
- move env-check implementation document 38 from `docs/` to
  `38-env-check-implementation.md`;
- update every legacy 37/38 link that pointed into `docs/`;
- register `CLAUDE.md`, `docs/runbook.md`, `docs/slo.md`,
  `docs/release-checklist.md`, and `docs/privacy-retention.md` in
  `activeDocuments`;
- document the layer rule in `36-document-sync-policy.md`;
- record the decision in `16-decisions.md`.

### F-06. Changelog order

`## Database v2 Foundation - 2026-06-28` was below
`## v2.0.0-alpha.1 - AI Team Mode - 2026-06-27`.

Resolution: move the newer 2026-06-28 section above the 2026-06-27 section.

### F-07. Dead exports

Decision D-2: **delete**.

Remove:

- `ensureGuestSessionId` from `src/lib/server/auth.ts` and its tests;
- `getModelById` from `src/lib/server/models.ts` and its tests;
- `saveWinnerVote` alias from `src/lib/server/votes.ts`.

### F-08. Team Mode persistence truth in `18-team-mode-spec.md`

The current `/api/team-run` runtime persists through `saveArenaRun`, which
stores Team Mode metadata in `tasks.settings` and step output in
`model_responses`. It does not write to `team_runs` or `team_run_steps`.

Resolution:

- update the header and section 13 to name `tasks.settings` +
  `model_responses` as current runtime persistence;
- mark `team_runs` and `team_run_steps` as `[future storage]`;
- remove the stale sentence claiming historical tables are added before v2.0;
- keep SQL schema sections as future storage documentation.

### F-09. CLAUDE.md version drift

Decision D-3: **Variant A**. Do not add SYNC plugin code. Remove hardcoded
current-version claims from `CLAUDE.md` and point agents to `.project/state.json`
and `AGENTS.md` for current truth.

Resolution:

- remove stale “current v1.7” wording;
- replace exhausted “do not add before v2.0/v1.8” statements with current
  operating constraints;
- keep `CLAUDE.md` as a concise agent entrypoint, not a version SSOT.

### F-10. Mandatory-document list alignment

`AGENTS.md`, `CLAUDE.md`, and `24-codex-active-rule-set.md` had different
mandatory-read lists.

Resolution:

- make `24-codex-active-rule-set.md` the full mandatory list;
- add `36-document-sync-policy.md` to that full list;
- label the shorter lists in `AGENTS.md` and `CLAUDE.md` as startup minimums
  and point to section “Обязательные документы” in 24 for the full list.

## Owner Decisions

```text
D-1 = A: root numbered document canon
D-2 = delete dead exports
D-3 = A: remove hardcoded current-version claims from CLAUDE.md
```

## Final Diff Rules

Do not change `package.json`, `package-lock.json`, migrations, env files,
production config, or scripts. Do not implement backlog features. Do not push,
merge, or deploy without explicit owner confirmation.

## Required Final Checks

```text
npm run typecheck
npm run lint
npm test
npm run test:env-check
npm run build
npm run docs:check
npm run state:check
```
