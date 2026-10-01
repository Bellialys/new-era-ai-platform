-- Enforce one live user-owned OpenRouter credential per user/provider across OAuth and manual BYOK.
CREATE UNIQUE INDEX IF NOT EXISTS uq_provider_credentials_one_live_user_owned
  ON public.provider_credentials (user_id, provider)
  WHERE origin IN ('user_oauth', 'user_manual')
    AND status IN ('pending', 'active');
