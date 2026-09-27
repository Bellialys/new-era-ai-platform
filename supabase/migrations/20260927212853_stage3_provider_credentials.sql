-- =============================================================================
-- Stage 3 provider credential data foundation.
-- Prepared for Free-first OpenRouter OAuth PKCE.
--
-- IMPORTANT:
-- - no plaintext provider API key column exists;
-- - direct anon/authenticated access is revoked;
-- - runtime activation is intentionally deferred until encrypted persistence
--   (AWS KMS + Vercel OIDC target from ADR-004/DEC-018) is operational.
-- =============================================================================

CREATE TABLE public.provider_credentials (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider           text        NOT NULL DEFAULT 'openrouter'
                     CONSTRAINT provider_credentials_provider_check
                     CHECK (provider = 'openrouter'),
  origin             text        NOT NULL
                     CONSTRAINT provider_credentials_origin_check
                     CHECK (origin IN ('user_oauth', 'user_manual', 'platform_managed')),
  status             text        NOT NULL DEFAULT 'pending'
                     CONSTRAINT provider_credentials_status_check
                     CHECK (status IN ('pending', 'active', 'revoking', 'revoked', 'orphaned', 'error')),

  provider_key_hash  text,
  safe_fingerprint   text,

  secret_ciphertext  bytea,
  encrypted_dek      bytea,
  kms_key_id         text,
  encryption_version smallint    NOT NULL DEFAULT 1
                     CONSTRAINT provider_credentials_encryption_version_check
                     CHECK (encryption_version > 0),

  limit_usd          numeric(12, 6)
                     CONSTRAINT provider_credentials_limit_check
                     CHECK (limit_usd IS NULL OR limit_usd >= 0),
  limit_reset        text
                     CONSTRAINT provider_credentials_limit_reset_check
                     CHECK (limit_reset IS NULL OR limit_reset IN ('daily', 'weekly', 'monthly')),
  expires_at         timestamptz,
  last_verified_at   timestamptz,
  last_used_at       timestamptz,
  reconcile_after    timestamptz,
  revoked_at         timestamptz,
  last_error_code    text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT provider_credentials_active_secret_check
  CHECK (
    status <> 'active'
    OR (
      secret_ciphertext IS NOT NULL
      AND octet_length(secret_ciphertext) > 0
      AND encrypted_dek IS NOT NULL
      AND octet_length(encrypted_dek) > 0
      AND kms_key_id IS NOT NULL
      AND btrim(kms_key_id) <> ''
    )
  )
);

COMMENT ON TABLE public.provider_credentials IS
  'Server-only encrypted provider credentials. Never stores plaintext API keys.';
COMMENT ON COLUMN public.provider_credentials.provider_key_hash IS
  'Non-secret provider key hash/identifier when available; never the raw credential.';
COMMENT ON COLUMN public.provider_credentials.safe_fingerprint IS
  'Safe display/audit fingerprint; never sufficient to reconstruct the credential.';
COMMENT ON COLUMN public.provider_credentials.secret_ciphertext IS
  'AES-256-GCM encrypted provider credential payload; plaintext is never persisted.';
COMMENT ON COLUMN public.provider_credentials.encrypted_dek IS
  'Wrapped data-encryption key; requires the configured KMS boundary to decrypt.';

CREATE INDEX idx_provider_credentials_user_status
  ON public.provider_credentials (user_id, status, created_at DESC);

CREATE INDEX idx_provider_credentials_reconcile
  ON public.provider_credentials (reconcile_after)
  WHERE reconcile_after IS NOT NULL;

CREATE UNIQUE INDEX uq_provider_credentials_one_live_origin
  ON public.provider_credentials (user_id, provider, origin)
  WHERE status IN ('pending', 'active');

ALTER TABLE public.provider_credentials ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.provider_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.provider_credentials TO service_role;

CREATE POLICY provider_credentials_service_role_select
ON public.provider_credentials
FOR SELECT
TO service_role
USING (true);

CREATE POLICY provider_credentials_service_role_insert
ON public.provider_credentials
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY provider_credentials_service_role_update
ON public.provider_credentials
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY provider_credentials_service_role_delete
ON public.provider_credentials
FOR DELETE
TO service_role
USING (true);

CREATE TABLE public.ai_funding_preferences (
  user_id          uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  funding_source   text        NOT NULL DEFAULT 'platform'
                   CONSTRAINT ai_funding_preferences_source_check
                   CHECK (funding_source IN ('platform', 'user_openrouter')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_funding_preferences IS
  'Server-controlled funding selection. Free-first OAuth uses user_openrouter after a usable encrypted credential exists.';

ALTER TABLE public.ai_funding_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ai_funding_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_funding_preferences TO service_role;

CREATE POLICY ai_funding_preferences_service_role_select
ON public.ai_funding_preferences
FOR SELECT
TO service_role
USING (true);

CREATE POLICY ai_funding_preferences_service_role_insert
ON public.ai_funding_preferences
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY ai_funding_preferences_service_role_update
ON public.ai_funding_preferences
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY ai_funding_preferences_service_role_delete
ON public.ai_funding_preferences
FOR DELETE
TO service_role
USING (true);
