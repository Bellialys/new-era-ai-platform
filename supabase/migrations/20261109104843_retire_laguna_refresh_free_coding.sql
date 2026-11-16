-- Model catalog maintenance (2026-11-09).
-- Poolside Laguna S 2.1 / XS 2.1 free offers expired 2026-10-31.
-- Keep historical model rows (votes/tasks still reference them); deactivate only.
-- New free chat completions ids are verified against OpenRouter model pages.
-- Dots3-Note Preview is time-limited through 2026-12-31; revalidate before that date.

UPDATE public.models SET
  is_active = false,
  is_public = false,
  updated_at = now()
WHERE model_key IN (
  'poolside/laguna-s-2.1:free',
  'poolside/laguna-xs-2.1:free'
);

INSERT INTO public.models (
  provider, model_key, display_name, description, price_label,
  is_active, is_public, role_tags, context_length, max_output_tokens,
  sort_order, raw_metadata, access_level, updated_at
)
VALUES
  (
    'openrouter',
    'dots-studio/dots-3-note-preview:free',
    'Dots3-Note Preview',
    'Free coding and reasoning model; OpenRouter offer expires 2026-12-31.',
    'free', true, true,
    ARRAY['coding','reasoning','agentic','long-context']::text[],
    512000, 8192, 60,
    '{"catalog_checked_at":"2026-11-09","expiration_date":"2026-12-31","source":"https://openrouter.ai/dots-studio/dots-3-note-preview:free"}'::jsonb,
    'anonymous',now()
  ),
  (
    'openrouter',
    'xingchen-agi/xing4.0-29b-a4b:free',
    'Xing4.0 29B A4B',
    'Free engineering and agent model for code, planning and tools.',
    'free', true, true,
    ARRAY['coding','reasoning','agentic','fast']::text[],
    262144, 8192, 70,
    '{"catalog_checked_at":"2026-11-09","source":"https://openrouter.ai/xingchen-agi/xing4.0-29b-a4b:free"}'::jsonb,
    'anonymous',now()
  )
ON CONFLICT (model_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_label = EXCLUDED.price_label,
  is_active = EXCLUDED.is_active,
  is_public = EXCLUDED.is_public,
  role_tags = EXCLUDED.role_tags,
  context_length = EXCLUDED.context_length,
  max_output_tokens = EXCLUDED.max_output_tokens,
  sort_order = EXCLUDED.sort_order,
  raw_metadata = EXCLUDED.raw_metadata,
  access_level = EXCLUDED.access_level,
  updated_at = now();
