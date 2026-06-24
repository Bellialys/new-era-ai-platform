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

- `26-definition-of-done.md`.
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

## v0.5.3 stabilization status

The earlier limitation is closed:

- `src/components/arena/prompt-arena.tsx` stores `taskId` from `/api/compare`;
- Winner selection calls `POST /api/vote`;
- UI shows saving, success and error states;
- Winner button is disabled when the comparison was not saved in Supabase;
- `src/components/arena/prompt-arena-voting.tsx` is now only a compatibility alias;
- `README.md`, `AGENTS.md` and `15-changelog.md` are updated to `v0.5.3`;
- temporary addendum/status files were integrated, archived or removed.

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

`14-roadmap.md` is the main project status source. This file is now a historical audit/stabilization record for the v0.5.3 voting work.
