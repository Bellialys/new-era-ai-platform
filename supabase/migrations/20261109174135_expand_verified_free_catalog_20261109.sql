-- Free chat catalog expansion, 2026-11-09.
-- OpenRouter provider pages advertise these free IDs. No authorized project-key
-- inference probe has been run: do not label them as live_verified.
-- Preserve historical rows and metadata. Only additive registration + ordering.
-- Free endpoints can impose per-account quotas, terms, and provider logging.

INSERT INTO public.models (
  provider, model_key, display_name, description, price_label,
  is_active, is_public, role_tags, context_length, max_output_tokens,
  sort_order, input_price_per_million, output_price_per_million,
  raw_metadata, access_level, updated_at
) VALUES
(
  'openrouter','nvidia/nemotron-3-ultra-550b-a55b:free','Nemotron 3 Ultra',
  'Free NVIDIA reasoning model; avoid sensitive data. Listed by provider, not live-probed.',
  'free',true,true,ARRAY['reasoning','agentic','long-context','experimental']::text[],
  1000000,8192,90,0,0,
  '{"catalog_checked_at":"2026-11-09","verification_status":"provider_listed_live_not_tested","data_policy":"nvidia_free_non_sensitive_provider_logging","supports_text":true,"supports_code":false,"source":"https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free"}'::jsonb,
  'anonymous',now()
),(
  'openrouter','recursive/flint-v1.0:free','Recursive Flint v1.0',
  'Free coding model; listed by provider, not live-probed.',
  'free',true,true,ARRAY['coding','agentic','experimental']::text[],
  262144,8192,100,0,0,
  '{"catalog_checked_at":"2026-11-09","verification_status":"provider_listed_live_not_tested","data_policy":"provider_policy_applies","supports_text":true,"supports_code":true,"source":"https://openrouter.ai/recursive/flint-v1.0:free"}'::jsonb,
  'anonymous',now()
),(
  'openrouter','liquid/lfm-3-1.7b:free','LFM3 1.7B',
  'Free compact model; provider may retain/use prompts and outputs for training. Not live-probed.',
  'free',true,true,ARRAY['general','fast','extraction','experimental']::text[],
  262144,8192,110,0,0,
  '{"catalog_checked_at":"2026-11-09","verification_status":"provider_listed_live_not_tested","data_policy":"liquid_free_inputs_outputs_may_be_retained_and_train","supports_text":true,"supports_code":false,"source":"https://openrouter.ai/liquid/lfm-3-1.7b:free"}'::jsonb,
  'anonymous',now()
)
ON CONFLICT (model_key) DO UPDATE SET
  display_name=excluded.display_name,
  description=excluded.description,
  price_label=excluded.price_label,
  is_active=excluded.is_active,
  is_public=excluded.is_public,
  role_tags=excluded.role_tags,
  context_length=excluded.context_length,
  max_output_tokens=excluded.max_output_tokens,
  sort_order=excluded.sort_order,
  input_price_per_million=excluded.input_price_per_million,
  output_price_per_million=excluded.output_price_per_million,
  raw_metadata=coalesce(public.models.raw_metadata,'{}'::jsonb) || excluded.raw_metadata,
  access_level=excluded.access_level,
  updated_at=now();

-- Put two models with successful inference logged today at top of Prompt Arena
-- without changing hardcoded Judge and Team defaults.
UPDATE public.models SET sort_order=1, updated_at=now()
WHERE model_key='cohere/north-mini-code:free' AND is_active AND is_public;
UPDATE public.models SET sort_order=2, updated_at=now()
WHERE model_key='dots-studio/dots-3-note-preview:free' AND is_active AND is_public;
