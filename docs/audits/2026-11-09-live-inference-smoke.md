# Production AI inference smoke audit — 2026-11-09

## Scope
Live unauthenticated guest flow: POST /api/guest -> POST /api/compare
on https://new-era-ai-platform.vercel.app using a harmless prompt asking for `OK`.
Models queried concurrently in batches of at most five. HTTP 200 at the
compare endpoint does **not** prove all models succeeded: inspect each
response.status, errorCode and answerText.

## Results (11/11 invoked)
| Model | First attempt | Second attempt | Action |
|---|---|---|---|
| North Mini Code | success, OK, 464ms | not needed | kept |
| Dots3-Note Preview | success, OK, 1390ms | not needed | kept |
| Gemma 4 26B A4B | RATE_LIMIT | RATE_LIMIT | quarantined |
| Gemma 4 31B | RATE_LIMIT | RATE_LIMIT | quarantined |
| Nemotron 3.5 Lightning | success, OK, 3364ms | not needed | kept |
| Nemotron 3 Super | 404: free endpoint unavailable | not needed | quarantined |
| Xing4.0 29B A4B | INVALID_RESPONSE (empty text) | INVALID_RESPONSE (empty text) | quarantined |
| LFM 2.5 2.6B | success, OK, 300ms | not needed | kept |
| Nemotron 3 Ultra | success, OK, 2788ms | not needed | kept |
| Recursive Flint v1.0 | success, OK, 667ms | not needed | kept |
| LFM3 1.7B | success, OK, 7609ms | not needed | kept |

All inference tests used the actual production site with a fresh guest cookie
and valid public model UUIDs returned by its live /api/models endpoint.
The two repeat tests for Gemma and Xing used a different small text prompt.
No privileged API credentials were read or exposed.

## Intervention
Applied production Supabase migration
`20261109182049_quarantine_failed_free_inference_models_20261109`:
four failures set `is_active=false`, `is_public=false` and recorded
specific error/verification metadata in `raw_metadata`. Models and usage
history were **not deleted**. Post-migration SQL verified seven public active
and four quarantined. Production GET /api/models and /api/code-models were
queried after migration, returning HTTP 200 with the narrowed catalog.

Seven successful models are **point-in-time observations**, not an uptime SLA.
Some free providers are rate-limited and may later become unavailable.
No application source merge/deploy performed in this audit: this is a
production database catalog adjustment only.

## Follow-up
- Periodically retest quarantined endpoints, and re-enable only if actual
  inference responds with non-empty text; never enable the 404 retired free slug.
- Build an authorized automatic health checker with safe rate limiting and
  bounded OpenRouter spend; current GitHub Actions OPENROUTER_API_KEY secret was
  reported missing at the time of the preceding audit.
- Keep security issue #136 and stacked PRs #137/#138 subject to CI,
  vulnerability audit and review before production code promotion.
