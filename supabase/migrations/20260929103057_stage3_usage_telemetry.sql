-- Stage 3.3: enrich usage_events for provider-actual cost attribution.
-- Existing rows remain valid; new runtime writes populate the added metadata.

ALTER TABLE public.usage_events
  ADD COLUMN IF NOT EXISTS total_tokens integer,
  ADD COLUMN IF NOT EXISTS billing_source text,
  ADD COLUMN IF NOT EXISTS credential_id uuid REFERENCES public.provider_credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS provider_request_id text,
  ADD COLUMN IF NOT EXISTS provider_model_key text,
  ADD COLUMN IF NOT EXISTS provider_usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS provider_is_byok boolean,
  ADD COLUMN IF NOT EXISTS cost_source text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS request_kind text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_events_billing_source_check'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_billing_source_check
      CHECK (billing_source IS NULL OR billing_source IN ('platform', 'user_openrouter'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_events_cost_source_check'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_cost_source_check
      CHECK (cost_source IS NULL OR cost_source IN ('provider_usage', 'estimated', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'usage_events_request_kind_check'
      AND conrelid = 'public.usage_events'::regclass
  ) THEN
    ALTER TABLE public.usage_events
      ADD CONSTRAINT usage_events_request_kind_check
      CHECK (request_kind IS NULL OR request_kind IN ('text', 'stream', 'image'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_usage_events_provider_request
  ON public.usage_events (provider_request_id)
  WHERE provider_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_events_billing_created
  ON public.usage_events (billing_source, created_at DESC)
  WHERE billing_source IS NOT NULL;
