-- Live inference smoke test on production, 2026-11-09.
-- Quarantine failing free endpoints; preserve all model IDs, usage and audit history.
-- Re-enable only after successful fresh provider inference tests.
UPDATE public.models
SET is_active = false,
    is_public = false,
    raw_metadata = COALESCE(raw_metadata, '{}'::jsonb) ||
      jsonb_build_object(
        'verification_status', 'live_inference_failed_2026_11_09',
        'verification_date', '2026-11-09',
        'verification_method', 'production_guest_api_compare',
        'verification_retest_required', true,
        'verification_failure', CASE model_key
          WHEN 'google/gemma-4-26b-a4b-it:free' THEN 'RATE_LIMIT twice'
          WHEN 'google/gemma-4-31b-it:free' THEN 'RATE_LIMIT twice'
          WHEN 'nvidia/nemotron-3-super-120b-a12b:free' THEN '404 free endpoint unavailable'
          WHEN 'xingchen-agi/xing4.0-29b-a4b:free' THEN 'INVALID_RESPONSE empty text twice'
          ELSE 'unknown' END
      ),
    updated_at = NOW()
WHERE model_key IN (
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'xingchen-agi/xing4.0-29b-a4b:free'
) AND is_active = true;
