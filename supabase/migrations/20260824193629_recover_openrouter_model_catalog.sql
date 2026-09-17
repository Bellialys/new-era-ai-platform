-- P0 provider recovery: align public.models with the curated public OpenRouter
-- text catalog re-verified on 2026-09-17.
--
-- Forward-only strategy:
--   1. Preserve historical rows and UUID references by deactivating, not
--      deleting, obsolete public text models.
--   2. Upsert the curated set by model_key so existing UUIDs remain stable.
--   3. Preserve image-generation rows managed by the Image Arena catalog.
--   4. Keep current capability and provider-data-policy metadata with each row.
--
-- This migration was confirmed absent from production migration history before
-- the 2026-09-17 refresh, so updating this pending file does not rewrite an
-- already-applied production migration.

begin;

update public.models
set
  is_active = false,
  is_public = false,
  raw_metadata = raw_metadata || jsonb_build_object(
    'is_active', false,
    'status', 'inactive',
    'verification_status', 'not_in_2026_09_public_text_catalog',
    'openrouter_verified_at', '2026-09-17T00:00:00Z',
    'verification_source', 'https://openrouter.ai/api/v1/models?output_modalities=text'
  ),
  updated_at = now()
where provider = 'openrouter'
  -- Image-generation entries have a separate catalog and must not be disabled
  -- by a text-provider recovery migration.
  and coalesce(raw_metadata ->> 'supports_image_generation', 'false') <> 'true'
  and model_key not in (
    'google/gemma-4-26b-a4b-it:free',
    'google/gemma-4-31b-it:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'cohere/north-mini-code:free',
    'poolside/laguna-s-2.1:free',
    'poolside/laguna-xs-2.1:free',
    'liquid/lfm-2.5-2.6b:free'
  );

with curated_models (
  model_key,
  display_name,
  description,
  role_tags,
  sort_order,
  context_length,
  max_output_tokens,
  supports_code,
  supports_image_input,
  data_policy,
  recommended_surface
) as (
  values
    (
      'google/gemma-4-26b-a4b-it:free',
      'Gemma 4 26B A4B',
      'Бесплатная мультимодальная MoE-модель Google Gemma 4 для общих задач и структурированных ответов.',
      array['general', 'reasoning', 'multimodal', 'default']::text[],
      10,
      262144,
      32768,
      false,
      true,
      'provider_policy_applies',
      'prompt_arena,team_mode,judge'
    ),
    (
      'google/gemma-4-31b-it:free',
      'Gemma 4 31B',
      'Бесплатная мультимодальная Gemma 4 31B для reasoning, документов и общих задач.',
      array['general', 'reasoning', 'multimodal']::text[],
      20,
      262144,
      32768,
      false,
      true,
      'provider_policy_applies',
      'prompt_arena,judge'
    ),
    (
      'nvidia/nemotron-3.5-lightning:free',
      'Nemotron 3.5 Lightning',
      'Бесплатная быстрая NVIDIA-модель с большим контекстом для agentic и general-сценариев.',
      array['general', 'reasoning', 'agentic', 'fast', 'long-context']::text[],
      30,
      1000000,
      65536,
      false,
      false,
      'nvidia_free_non_sensitive_provider_logging',
      'prompt_arena'
    ),
    (
      'nvidia/nemotron-3-super-120b-a12b:free',
      'Nemotron 3 Super',
      'Бесплатная reasoning-модель NVIDIA; free endpoint может быть нестабилен и не используется как default.',
      array['reasoning', 'agentic', 'experimental']::text[],
      40,
      262144,
      262144,
      false,
      false,
      'nvidia_free_non_sensitive_provider_logging',
      'prompt_arena_experimental'
    ),
    (
      'cohere/north-mini-code:free',
      'North Mini Code',
      'Бесплатная Cohere-модель для генерации кода, terminal-задач и agentic software engineering.',
      array['coding', 'agentic', 'fast']::text[],
      50,
      256000,
      64000,
      true,
      false,
      'cohere_terms_apply',
      'code_arena'
    ),
    (
      'poolside/laguna-s-2.1:free',
      'Laguna S 2.1',
      'Бесплатная coding-agent модель Poolside для сложных задач программирования.',
      array['coding', 'agentic']::text[],
      60,
      262144,
      32768,
      true,
      false,
      'poolside_free_inputs_outputs_may_train',
      'code_arena'
    ),
    (
      'poolside/laguna-xs-2.1:free',
      'Laguna XS 2.1',
      'Бесплатная компактная coding-agent модель Poolside для быстрых сравнений кода.',
      array['coding', 'agentic', 'fast']::text[],
      70,
      262144,
      32768,
      true,
      false,
      'poolside_free_inputs_outputs_may_train',
      'code_arena'
    ),
    (
      'liquid/lfm-2.5-2.6b:free',
      'LFM 2.5 2.6B',
      'Бесплатная компактная LiquidAI-модель для extraction, RAG и быстрых agent workflows.',
      array['general', 'reasoning', 'fast', 'rag', 'extraction']::text[],
      80,
      65536,
      8192,
      false,
      false,
      'liquid_free_inputs_outputs_may_be_retained_and_train',
      'prompt_arena_fast_rag'
    )
)
insert into public.models as existing (
  provider,
  model_key,
  display_name,
  description,
  price_label,
  is_active,
  is_public,
  access_level,
  role_tags,
  context_length,
  max_output_tokens,
  input_price_per_million,
  output_price_per_million,
  sort_order,
  raw_metadata
)
select
  'openrouter',
  curated_models.model_key,
  curated_models.display_name,
  curated_models.description,
  'free',
  true,
  true,
  'anonymous',
  curated_models.role_tags,
  curated_models.context_length,
  curated_models.max_output_tokens,
  0,
  0,
  curated_models.sort_order,
  jsonb_build_object(
    'catalog_governance_version', 'v2.0.0-alpha.1-provider-recovery-2026-09-17',
    'provider', 'openrouter',
    'display_name', curated_models.display_name,
    'price_label', 'free',
    'pricing_type', 'free',
    'is_active', true,
    'status', 'active',
    'context_length', curated_models.context_length,
    'max_output_tokens', curated_models.max_output_tokens,
    'supports_text', true,
    'supports_code', curated_models.supports_code,
    'supports_image_input', curated_models.supports_image_input,
    'supports_image_generation', false,
    'verification_status', 'catalog_verified',
    'openrouter_verified_at', '2026-09-17T00:00:00Z',
    'verification_source', 'https://openrouter.ai/api/v1/models?output_modalities=text',
    'data_policy', curated_models.data_policy,
    'recommended_surface', curated_models.recommended_surface
  )
from curated_models
on conflict (model_key) do update set
  provider = excluded.provider,
  display_name = excluded.display_name,
  description = excluded.description,
  price_label = excluded.price_label,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  access_level = excluded.access_level,
  role_tags = excluded.role_tags,
  context_length = excluded.context_length,
  max_output_tokens = excluded.max_output_tokens,
  input_price_per_million = excluded.input_price_per_million,
  output_price_per_million = excluded.output_price_per_million,
  sort_order = excluded.sort_order,
  raw_metadata = existing.raw_metadata || excluded.raw_metadata,
  updated_at = now();

commit;

-- Rollback is intentionally not included: historical catalog rows are
-- preserved, and any correction must be delivered as a new forward migration.
