-- Deactivate free model ids that are no longer present in the live OpenRouter
-- catalog. Keep the rows for historical model_response references.

update public.models
set
  is_active = false,
  is_public = false,
  raw_metadata = raw_metadata || jsonb_build_object(
    'is_active', false,
    'status', 'inactive',
    'verification_status', 'not_found_in_openrouter_models_verify',
    'openrouter_verified_at', '2026-06-11'
  ),
  updated_at = now()
where provider = 'openrouter'
  and model_key in (
    'z-ai/glm-4.5-air:free',
    'moonshotai/kimi-k2.6:free'
  );
