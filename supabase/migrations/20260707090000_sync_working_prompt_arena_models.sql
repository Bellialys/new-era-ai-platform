-- Sync Prompt Arena to the free OpenRouter models that passed provider smoke on
-- 2026-07-07. Historical rows are kept for old model_responses references; the
-- room only exposes active/public rows from this curated set.

with curated(model_key) as (
  values
    ('openai/gpt-oss-20b:free'),
    ('nvidia/nemotron-3-nano-30b-a3b:free'),
    ('poolside/laguna-xs-2.1:free'),
    ('tencent/hy3:free'),
    ('liquid/lfm-2.5-1.2b-instruct:free'),
    ('nvidia/nemotron-nano-9b-v2:free'),
    ('nvidia/nemotron-3-super-120b-a12b:free'),
    ('nvidia/nemotron-3-ultra-550b-a55b:free'),
    ('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'),
    ('liquid/lfm-2.5-1.2b-thinking:free'),
    ('nvidia/nemotron-nano-12b-v2-vl:free'),
    ('poolside/laguna-m.1:free'),
    ('poolside/laguna-xs.2:free'),
    ('cohere/north-mini-code:free'),
    ('nvidia/nemotron-3.5-content-safety:free')
)
update public.models
set
  is_active = false,
  is_public = false,
  raw_metadata = raw_metadata || jsonb_build_object(
    'is_active', false,
    'status', 'inactive',
    'verification_status', 'provider_smoke_failed_or_not_prompt_arena_fit',
    'openrouter_verified_at', '2026-07-07'
  ),
  updated_at = now()
where provider = 'openrouter'
  and (price_label = 'free' or model_key like '%:free')
  and model_key not in (select model_key from curated);

with curated(
  model_key,
  display_name,
  description,
  role_tags,
  sort_order
) as (
  values
    ('openai/gpt-oss-20b:free','GPT-OSS 20B','Бесплатная компактная открытая модель OpenAI 20B для быстрых общих ответов.',array['general','fast']::text[],10),
    ('nvidia/nemotron-3-nano-30b-a3b:free','Nemotron 3 Nano 30B','Бесплатная компактная reasoning-модель NVIDIA 30B для устойчивого дефолтного сравнения.',array['reasoning']::text[],20),
    ('poolside/laguna-xs-2.1:free','Laguna XS 2.1','Бесплатная code-oriented модель Poolside для быстрых Prompt Arena сравнений с coding-уклоном.',array['coding','fast']::text[],30),
    ('tencent/hy3:free','Tencent Hy3','Бесплатная Tencent Hy3; текущий OpenRouter каталог помечает её как limited-time free.',array['general','balanced']::text[],40),
    ('liquid/lfm-2.5-1.2b-instruct:free','LFM 2.5 1.2B','Бесплатная очень маленькая instruct-модель LiquidAI 1.2B для мгновенных ответов.',array['fast']::text[],50),
    ('nvidia/nemotron-nano-9b-v2:free','Nemotron Nano 9B','Бесплатная маленькая reasoning-модель NVIDIA 9B для быстрых ответов.',array['reasoning','fast']::text[],60),
    ('nvidia/nemotron-3-super-120b-a12b:free','Nemotron 3 Super','Бесплатная reasoning-модель NVIDIA 120B, контекст 1M.',array['reasoning']::text[],70),
    ('nvidia/nemotron-3-ultra-550b-a55b:free','Nemotron 3 Ultra','Бесплатная reasoning-модель NVIDIA 550B с контекстом 1M.',array['reasoning']::text[],80),
    ('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free','Nemotron 3 Nano Omni','Бесплатная reasoning-модель NVIDIA Nano Omni 30B для текстовых сравнений.',array['reasoning']::text[],90),
    ('liquid/lfm-2.5-1.2b-thinking:free','LFM 2.5 1.2B Thinking','Бесплатная thinking-модель LiquidAI 1.2B для быстрых reasoning-сравнений.',array['reasoning','fast']::text[],100),
    ('nvidia/nemotron-nano-12b-v2-vl:free','Nemotron Nano 12B VL','Бесплатная vision-capable модель NVIDIA 12B; в Prompt Arena используется как текстовая модель.',array['vision','fast']::text[],110),
    ('poolside/laguna-m.1:free','Laguna M.1','Бесплатная code-oriented модель Poolside для задач по программированию.',array['coding']::text[],120),
    ('poolside/laguna-xs.2:free','Laguna XS.2','Бесплатная компактная code-oriented модель Poolside для быстрых coding-сравнений.',array['coding','fast']::text[],130),
    ('cohere/north-mini-code:free','North Mini Code','Бесплатная code-модель Cohere для компактных задач по программированию.',array['coding']::text[],140),
    ('nvidia/nemotron-3.5-content-safety:free','Nemotron 3.5 Content Safety','Бесплатная специализированная safety-модель NVIDIA для moderation-oriented проверок.',array['safety']::text[],150)
)
insert into public.models (
  provider, model_key, display_name, description, price_label,
  is_active, is_public, access_level, role_tags, sort_order, raw_metadata
)
select
  'openrouter', model_key, display_name, description, 'free',
  true, true, 'anonymous', role_tags, sort_order,
  jsonb_build_object(
    'catalog_governance_version','v2.0.0-alpha.1-2026-07-07',
    'provider','openrouter',
    'display_name',display_name,
    'price_label','free',
    'pricing_type','free',
    'is_active',true,
    'status','active',
    'supports_text',true,
    'supports_code',role_tags && array['coding']::text[],
    'supports_image_input',role_tags && array['vision']::text[],
    'supports_image_generation',false,
    'verification_status','provider_smoke_passed',
    'openrouter_verified_at','2026-07-07'
  )
from curated
on conflict (model_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  price_label = excluded.price_label,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  access_level = excluded.access_level,
  role_tags = excluded.role_tags,
  sort_order = excluded.sort_order,
  raw_metadata = models.raw_metadata || excluded.raw_metadata,
  updated_at = now();
