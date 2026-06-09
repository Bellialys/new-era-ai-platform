-- v0.5.3 model catalog governance metadata.
--
-- This migration does not add new user-facing features and does not change
-- model_key values. It prepares the current MVP models table for future
-- governance by storing capability/status metadata in raw_metadata.
--
-- OpenRouter model IDs are not marked as live-verified here. Verification must
-- be performed separately with an actual OpenRouter API key before public deploy.

update public.models
set
  raw_metadata = raw_metadata || jsonb_build_object(
    'catalog_governance_version', 'v0.5.3',
    'provider', provider,
    'display_name', display_name,
    'price_label', price_label,
    'pricing_type', price_label,
    'max_output_tokens', max_output_tokens,
    'is_active', is_active,
    'status', case when is_active then 'active' else 'inactive' end,
    'supports_text', true,
    'supports_code', role_tags && array['coding'],
    'supports_image_input', false,
    'supports_image_generation', false,
    'verification_status', 'needs_openrouter_check',
    'openrouter_verified_at', null
  ),
  updated_at = now()
where provider = 'openrouter';
