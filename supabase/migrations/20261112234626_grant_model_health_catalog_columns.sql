-- The model health job updates lifecycle state and inserts pending discoveries
-- through the server-only Supabase client. Keep the grants column-scoped.
grant update (is_active, is_public, raw_metadata, updated_at)
  on table public.models to service_role;

grant insert (
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
) on table public.models to service_role;
