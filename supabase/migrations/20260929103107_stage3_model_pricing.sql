-- Stage 3.3: published OpenRouter pricing snapshots.
-- Keeps provider raw pricing so non-token image/request units are not lost.

ALTER TABLE public.model_price_history
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'openrouter',
  ADD COLUMN IF NOT EXISTS raw_pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

UPDATE public.model_price_history
SET source_checked_at = COALESCE(source_checked_at, created_at)
WHERE source_checked_at IS NULL;

ALTER TABLE public.model_price_history
  ALTER COLUMN source_checked_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_model_price_history_current_provider_model
  ON public.model_price_history (provider, model_key, effective_from DESC)
  WHERE effective_to IS NULL;

REVOKE ALL ON TABLE public.model_price_history FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.model_price_history TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_model_price_snapshot(
  p_model_key text,
  p_provider text,
  p_input_price_per_million numeric,
  p_output_price_per_million numeric,
  p_raw_pricing jsonb,
  p_checked_at timestamptz,
  p_currency text,
  p_source text
)
RETURNS TABLE(changed boolean, price_history_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_current public.model_price_history%ROWTYPE;
  v_new_id uuid;
BEGIN
  IF
    p_model_key IS NULL OR btrim(p_model_key) = '' OR
    p_provider IS NULL OR btrim(p_provider) = '' OR
    p_checked_at IS NULL OR
    p_currency IS NULL OR btrim(p_currency) = '' OR
    p_source IS NULL OR btrim(p_source) = ''
  THEN
    RAISE EXCEPTION 'INVALID_PRICE_SNAPSHOT';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_provider || ':' || p_model_key, 0)
  );

  SELECT *
  INTO v_current
  FROM public.model_price_history
  WHERE provider = p_provider
    AND model_key = p_model_key
    AND effective_to IS NULL
  ORDER BY effective_from DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND
    AND v_current.input_price_per_million IS NOT DISTINCT FROM p_input_price_per_million
    AND v_current.output_price_per_million IS NOT DISTINCT FROM p_output_price_per_million
    AND v_current.raw_pricing = COALESCE(p_raw_pricing, '{}'::jsonb)
    AND v_current.currency = p_currency
  THEN
    UPDATE public.model_price_history
    SET source_checked_at = p_checked_at,
        source = p_source
    WHERE id = v_current.id;

    RETURN QUERY SELECT false, v_current.id;
    RETURN;
  END IF;

  IF FOUND THEN
    UPDATE public.model_price_history
    SET effective_to = p_checked_at,
        source_checked_at = GREATEST(
          COALESCE(source_checked_at, p_checked_at),
          p_checked_at
        )
    WHERE id = v_current.id;
  END IF;

  INSERT INTO public.model_price_history (
    model_key,
    input_price_per_million,
    output_price_per_million,
    effective_from,
    effective_to,
    source,
    provider,
    raw_pricing,
    source_checked_at,
    currency
  )
  VALUES (
    p_model_key,
    p_input_price_per_million,
    p_output_price_per_million,
    p_checked_at,
    NULL,
    p_source,
    p_provider,
    COALESCE(p_raw_pricing, '{}'::jsonb),
    p_checked_at,
    p_currency
  )
  RETURNING id INTO v_new_id;

  RETURN QUERY SELECT true, v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_model_price_snapshot(
  text, text, numeric, numeric, jsonb, timestamptz, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.upsert_model_price_snapshot(
  text, text, numeric, numeric, jsonb, timestamptz, text, text
) TO service_role;
