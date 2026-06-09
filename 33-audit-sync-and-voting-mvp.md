# 33 - Audit Sync and Voting MVP

## Status

This file records the audit fix applied after the repository consistency review.

Current practical status:

- Prompt Arena MVP exists.
- Supabase persistence exists as best-effort storage.
- Model catalog is Supabase-first with hardcoded fallback.
- `tasks.task_text` is the canonical task field.
- `prompt_text` is obsolete and must not be used in new code.
- `votes.model_response_id` plus `vote_type = best` is the current voting schema.

## Applied changes

### Added

- `25-definition-of-done.md`.
- `29-database-ownership-policy.md`.
- `28-api-contracts.md` with the MVP API details.
- `30-data-retention-policy.md` with the MVP retention rules.
- `src/app/api/vote/route.ts` for saving the best response vote.

## Voting API

`POST /api/vote` saves the best vote.

Expected request fields:

- `taskId`;
- `responseId`;
- `voteType = best`;
- `anonymousSessionId` or `userId`.

The route uses the existing server helper `saveBestVote`.

## Important limitation

The backend vote route is added, but `src/components/arena/prompt-arena.tsx` still needs to call `/api/vote` from the winner button.

The GitHub connector allowed new files, but blocked updates to existing files during this audit session. Because of that, existing files that still need direct updates are listed below.

## Files still needing direct update

- `README.md` - update project status from `v0.4.1` to current Supabase MVP status.
- `AGENTS.md` - update current status and next stage.
- `15-changelog.md` - add `v0.5.3 - Audit Sync and Voting MVP`.
- `src/components/arena/arena-form.tsx` - replace visible `v0.4` badge with `v0.5` or `v0.5.3`.
- `src/components/arena/prompt-arena.tsx` - store `taskId` from `/api/compare` and call `/api/vote` when selecting a winner.
- `src/components/arena/arena-results.tsx` - pass vote saving state/message to the result area.
- `src/components/arena/response-card.tsx` - optionally disable the winner button while the vote is saving.
- `32-model-catalog-governance.md` - mark the extended schema as future governance unless migrations are added.
- Delete temporary `99-write-check.md`.

## Required verification

```bash
npm run typecheck
# check TypeScript

npm run lint
# check ESLint

npm run build
# check production build

npm run smoke
# check smoke scenario
```

## Rule for Codex

Until `README.md` and `AGENTS.md` are updated, this file and `08-database.md` should be treated as the more current project status for Supabase and voting work.
