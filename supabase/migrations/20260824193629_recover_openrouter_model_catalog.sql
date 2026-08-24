-- P0 provider recovery: align public.models with the curated OpenRouter text
-- catalog verified against the provider discovery endpoint on 2026-08-24.
--
-- Forward-only strategy:
--   1. Preserve historical rows and UUID references by deactivating, not
--      deleting, OpenRouter models outside the curated set.
--   2. Upsert the curated set by model_key so existing UUIDs remain stable.
--   3. Keep operational capability metadata with the catalog row.

begin;

update public.models
set
  is_active = false,
  is_public = false,
  raw_metadata = raw_metadata || jsonb_build_object(
    'is_active', false,
    'status', 'inactive',
    'verification_status', 'not_in_provider_recovery_catalog',
    'openrouter_verified_at', '2026-08-24T00:00:00Z',
    'verification_source', 'https://openrouter.ai/api/v1/models?output_modalities=text'
  ),
  updated_at = now()
where provider = 'openrouter'
  and model_key not in (
    'z-ai/glm-5.2:free',
    'thinkingmachines/inkling:free',
    'thinkingmachines/inkling-small:free',
    'nvidia/nemotron-3.5-lightning:free',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'nvidia/nemotron-3-super-120b-a12b:free',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
    'google/gemma-4-31b-it:free',
    'google/gemma-4-26b-a4b-it:free',
    'poolside/laguna-s-2.1:free',
    'poolside/laguna-xs-2.1:free',
    'cohere/north-mini-code:free',
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
  supports_image_input
) as (
  values
    (
      'z-ai/glm-5.2:free',
      'GLM 5.2',
      'Бесплатная reasoning-модель Z.AI для длинных agentic-задач и разработки ПО.',
      array['general', 'reasoning', 'agentic']::text[],
      10,
      256000,
      256000,
      false,
      false
    ),
    (
      'thinkingmachines/inkling:free',
      'Inkling',
      'Бесплатная мультимодальная reasoning-модель Thinking Machines для coding и tool-use сценариев.',
      array['general', 'reasoning', 'agentic', 'multimodal']::text[],
      20,
      262144,
      262144,
      false,
      true
    ),
    (
      'thinkingmachines/inkling-small:free',
      'Inkling Small',
      'Бесплатная компактная мультимодальная модель Thinking Machines для быстрых reasoning-задач.',
      array['general', 'reasoning', 'fast', 'multimodal']::text[],
      30,
      262144,
      262144,
      false,
      true
    ),
    (
      'nvidia/nemotron-3.5-lightning:free',
      'Nemotron 3.5 Lightning',
      'Бесплатная высокопроизводительная agentic-модель NVIDIA с контекстом 1M.',
      array['general', 'reasoning', 'agentic', 'fast', 'long-context']::text[],
      40,
      1000000,
      65536,
      false,
      false
    ),
    (
      'nvidia/nemotron-3-ultra-550b-a55b:free',
      'Nemotron 3 Ultra',
      'Бесплатная frontier-reasoning и orchestration-модель NVIDIA с контекстом 1M.',
      array['reasoning', 'agentic', 'long-context']::text[],
      50,
      1000000,
      65536,
      false,
      false
    ),
    (
      'nvidia/nemotron-3-super-120b-a12b:free',
      'Nemotron 3 Super',
      'Бесплатная reasoning-модель NVIDIA для сложных multi-agent и coding-сценариев.',
      array['reasoning', 'agentic']::text[],
      60,
      262144,
      262144,
      false,
      false
    ),
    (
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'Nemotron 3 Nano Omni',
      'Бесплатная мультимодальная reasoning-модель NVIDIA для perception и agentic-сценариев.',
      array['reasoning', 'agentic', 'multimodal']::text[],
      70,
      256000,
      65536,
      false,
      true
    ),
    (
      'google/gemma-4-31b-it:free',
      'Gemma 4 31B',
      'Бесплатная мультимодальная instruct-модель Google Gemma 4 для общих задач.',
      array['general', 'reasoning', 'open-source', 'multimodal']::text[],
      80,
      262144,
      32768,
      false,
      true
    ),
    (
      'google/gemma-4-26b-a4b-it:free',
      'Gemma 4 26B A4B',
      'Бесплатная мультимодальная MoE instruct-модель Google Gemma 4.',
      array['general', 'reasoning', 'open-source', 'fast', 'multimodal']::text[],
      90,
      262144,
      32768,
      false,
      true
    ),
    (
      'poolside/laguna-s-2.1:free',
      'Laguna S 2.1',
      'Бесплатная coding-agent модель Poolside для сложных задач программирования.',
      array['coding', 'agentic']::text[],
      100,
      262144,
      32768,
      true,
      false
    ),
    (
      'poolside/laguna-xs-2.1:free',
      'Laguna XS 2.1',
      'Бесплатная компактная coding-agent модель Poolside для быстрых задач программирования.',
      array['coding', 'agentic', 'fast']::text[],
      110,
      262144,
      32768,
      true,
      false
    ),
    (
      'cohere/north-mini-code:free',
      'North Mini Code',
      'Бесплатная компактная agentic coding-модель Cohere.',
      array['coding', 'agentic', 'fast']::text[],
      120,
      256000,
      64000,
      true,
      false
    ),
    (
      'liquid/lfm-2.5-2.6b:free',
      'LFM 2.5 2.6B',
      'Бесплатная компактная reasoning-модель LiquidAI для extraction, RAG и agent workflows.',
      array['general', 'reasoning', 'fast']::text[],
      130,
      65536,
      8192,
      false,
      false
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
    'catalog_governance_version', 'v2.0.0-alpha.1-provider-recovery',
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
    'verification_status', 'verified',
    'openrouter_verified_at', '2026-08-24T00:00:00Z',
    'verification_source', 'https://openrouter.ai/api/v1/models?output_modalities=text'
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
