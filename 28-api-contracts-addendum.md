# 28 - API Contracts Addendum

This file is a temporary addendum for `28-api-contracts.md`.

The main contract document now contains the MVP baseline. Keep this addendum only for short-lived notes that still need to be folded into the main document.

## Current MVP endpoints

`GET /api/models` returns available models.

`POST /api/compare` runs Prompt Arena comparison.

`POST /api/vote` stores the best response vote.

## Frontend rule

The frontend must call only backend endpoints. Provider calls must stay server-side.

## Compare request

Fields:

- `prompt`;
- `modelIds`;
- `modeSlug`.

## Compare response

Fields:

- `status`;
- `taskId`;
- `responses`.

## Vote request

Fields:

- `taskId`;
- `responseId`;
- `voteType`;
- `anonymousSessionId` or `userId`.

## Vote response

Fields:

- `status`;
- `voteId`;
- `taskId`;
- `responseId`;
- `voteType`.
