-- Lab 05: isolated, owner-scoped saved prompts CRUD.
-- Additive migration; no existing application tables are changed.
CREATE TABLE IF NOT EXISTS public.saved_prompts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  prompt_text  text NOT NULL CHECK (char_length(btrim(prompt_text)) BETWEEN 3 AND 8000),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS saved_prompts_user_updated_idx
  ON public.saved_prompts (user_id, updated_at DESC, id DESC);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;

-- The API owns all data access and derives identity from verified Supabase Auth.
-- A public client must not access rows directly, even if a publishable key leaks.
REVOKE ALL ON TABLE public.saved_prompts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.saved_prompts TO service_role;

DROP POLICY IF EXISTS saved_prompts_service_select ON public.saved_prompts;
DROP POLICY IF EXISTS saved_prompts_service_insert ON public.saved_prompts;
DROP POLICY IF EXISTS saved_prompts_service_update ON public.saved_prompts;
DROP POLICY IF EXISTS saved_prompts_service_delete ON public.saved_prompts;

CREATE POLICY saved_prompts_service_select ON public.saved_prompts
  FOR SELECT TO service_role USING (true);
CREATE POLICY saved_prompts_service_insert ON public.saved_prompts
  FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY saved_prompts_service_update ON public.saved_prompts
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
CREATE POLICY saved_prompts_service_delete ON public.saved_prompts
  FOR DELETE TO service_role USING (true);

COMMENT ON TABLE public.saved_prompts IS
  'Owner-scoped prompt drafts for Lab 05 CRUD. Access only through authenticated server routes.';
