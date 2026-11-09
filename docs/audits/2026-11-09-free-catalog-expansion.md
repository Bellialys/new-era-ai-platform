# Free-model expansion — 2026-11-09

Scope: an additive, free-only extension based on the working catalog branch `fix/retired-free-models-20261109` (PR #137). Production source code remains unchanged until the security release gate is cleared.

## Changes

- Curated free text catalog: 8 -> 11 models.
- New provider-listed IDs: `nvidia/nemotron-3-ultra-550b-a55b:free`, `recursive/flint-v1.0:free` (also Code Arena), `liquid/lfm-3-1.7b:free`.
- Prompt Arena ordering puts North Mini Code, Dots3-Note Preview first, based on historical successful `model_responses` on 2026-11-09. These records do not imply guaranteed future availability.
- Historical model, task and usage rows remain intact. Forward-only DB migration `20261109174135_expand_verified_free_catalog_20261109` was applied to production Supabase on 2026-11-09; code and catalog reconciliation lives in this branch.
- Judge/Team defaults unchanged. Free smoke test supports up to 11 catalog models and rejects out-of-bounds selections.

## Evidence and limits

- https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free
- https://openrouter.ai/recursive/flint-v1.0:free
- https://openrouter.ai/liquid/lfm-3-1.7b:free
- **Provider-listed does not establish live inference success.** Real requests via the project OpenRouter key and quota are required; new entries have `verification_status=provider_listed_live_not_tested`.
- Free NVIDIA models may be logged by provider; Liquid may retain/train on inputs and outputs. Do not submit confidential prompts without reviewing the actual policy.
- Free endpoints may return rate limit, unavailable provider, timeout, or empty output. No paid models are enabled.
- The GitHub Actions `OPENROUTER_API_KEY` secret is missing for nightly live inference verification. Never put it into chat or code. Manual bounded smoke: `npm run models:smoke:live -- --limit=11` once safely configured.
- Security issue #136 (critical/high Next.js dependency advisories) remains a code-release blocker. Passing preview/CI checks does not override it.

## Rollback

- Keep history. Disable the three new rows using `is_active=false,is_public=false` rather than deleting, and restore North Mini Code/Dots sort_order to 50/60. Revert code separately if required.
