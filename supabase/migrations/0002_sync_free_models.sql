-- Sync the models table with the curated free OpenRouter set used by the app
-- (src/lib/server/models.ts). This is the single source of truth for v0.5.
--
-- Strategy:
--   1. Deactivate every model not in the curated list (kept, not deleted, so
--      historical model_responses.model_id foreign keys stay intact).
--   2. Upsert the curated free models with matching sort_order.
-- sort_order mirrors the array order in models.ts so DB-driven ordering matches
-- the current UI default-selection behaviour.

-- 1. Deactivate models that are no longer offered.
update public.models
set is_active = false,
    is_public = false,
    updated_at = now()
where model_key not in (
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'z-ai/glm-4.5-air:free',
  'moonshotai/kimi-k2.6:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'openai/gpt-oss-20b:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'qwen/qwen3-coder:free',
  'poolside/laguna-m.1:free',
  'poolside/laguna-xs.2:free',
  'liquid/lfm-2.5-1.2b-instruct:free'
);

-- 2. Upsert the curated free models.
insert into public.models (
  provider, model_key, display_name, description,
  price_label, is_active, is_public, role_tags, sort_order
)
values
  ('openrouter', 'openai/gpt-oss-120b:free', 'GPT-OSS 120B', 'Бесплатная открытая модель OpenAI на 120B — сильный универсальный baseline.', 'free', true, true, array['general'], 10),
  ('openrouter', 'meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B', 'Бесплатная instruct-модель Meta 70B — хороший баланс качества и скорости.', 'free', true, true, array['general','balanced'], 20),
  ('openrouter', 'qwen/qwen3-next-80b-a3b-instruct:free', 'Qwen3 Next 80B', 'Бесплатная instruct-модель Qwen 80B с большим контекстом.', 'free', true, true, array['general','balanced'], 30),
  ('openrouter', 'google/gemma-4-31b-it:free', 'Gemma 4 31B', 'Бесплатная модель Google Gemma 4 для общих ответов, контекст 262K.', 'free', true, true, array['general','open-source'], 40),
  ('openrouter', 'google/gemma-4-26b-a4b-it:free', 'Gemma 4 26B A4B', 'Бесплатная MoE-модель Google Gemma 4 — быстрее за счёт активных 4B параметров.', 'free', true, true, array['general','open-source'], 50),
  ('openrouter', 'z-ai/glm-4.5-air:free', 'GLM 4.5 Air', 'Бесплатная облегчённая модель Z.ai GLM для быстрых общих ответов.', 'free', true, true, array['general','fast'], 60),
  ('openrouter', 'moonshotai/kimi-k2.6:free', 'Kimi K2.6', 'Бесплатная модель MoonshotAI Kimi с контекстом 262K для длинных задач.', 'free', true, true, array['general','long-context'], 70),
  ('openrouter', 'nousresearch/hermes-3-llama-3.1-405b:free', 'Hermes 3 405B', 'Бесплатная 405B-модель Nous Research на базе Llama 3.1.', 'free', true, true, array['general'], 80),
  ('openrouter', 'openai/gpt-oss-20b:free', 'GPT-OSS 20B', 'Бесплатная компактная открытая модель OpenAI 20B для быстрых ответов.', 'free', true, true, array['general','fast'], 90),
  ('openrouter', 'meta-llama/llama-3.2-3b-instruct:free', 'Llama 3.2 3B', 'Бесплатная компактная модель Meta 3B — очень быстрая, для простых задач.', 'free', true, true, array['fast'], 100),
  ('openrouter', 'nvidia/nemotron-3-ultra-550b-a55b:free', 'Nemotron 3 Ultra', 'Бесплатная reasoning-модель NVIDIA 550B с контекстом 1M.', 'free', true, true, array['reasoning'], 110),
  ('openrouter', 'nvidia/nemotron-3-super-120b-a12b:free', 'Nemotron 3 Super', 'Бесплатная reasoning-модель NVIDIA 120B, контекст 1M.', 'free', true, true, array['reasoning'], 120),
  ('openrouter', 'nvidia/nemotron-3-nano-30b-a3b:free', 'Nemotron 3 Nano 30B', 'Бесплатная компактная reasoning-модель NVIDIA 30B.', 'free', true, true, array['reasoning'], 130),
  ('openrouter', 'nvidia/nemotron-nano-9b-v2:free', 'Nemotron Nano 9B', 'Бесплатная маленькая reasoning-модель NVIDIA 9B для быстрых ответов.', 'free', true, true, array['reasoning','fast'], 140),
  ('openrouter', 'qwen/qwen3-coder:free', 'Qwen3 Coder 480B', 'Бесплатная крупная code-модель Qwen3 Coder 480B с контекстом 1M.', 'free', true, true, array['coding'], 150),
  ('openrouter', 'poolside/laguna-m.1:free', 'Laguna M.1', 'Бесплатная code-oriented модель Poolside для задач по программированию.', 'free', true, true, array['coding'], 160),
  ('openrouter', 'poolside/laguna-xs.2:free', 'Laguna XS.2', 'Бесплатная компактная code-oriented модель Poolside для быстрых coding-сравнений.', 'free', true, true, array['coding','fast'], 170),
  ('openrouter', 'liquid/lfm-2.5-1.2b-instruct:free', 'LFM 2.5 1.2B', 'Бесплатная очень маленькая instruct-модель LiquidAI 1.2B для мгновенных ответов.', 'free', true, true, array['fast'], 180)
on conflict (model_key) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  price_label = excluded.price_label,
  is_active = excluded.is_active,
  is_public = excluded.is_public,
  role_tags = excluded.role_tags,
  sort_order = excluded.sort_order,
  updated_at = now();
