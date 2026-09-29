-- Stage 3.4 OpenRouter OAuth activation transaction.
--
-- The credential activation and funding preference change must commit together.
-- This closes the disconnect/callback race where an already-revoked credential
-- could otherwise be followed by a late user_openrouter funding write.
--
-- This RPC is server-only. Provider secret bytes are already AES-256-GCM
-- ciphertext and a wrapped DEK before they cross this database boundary.

create or replace function public.activate_openrouter_oauth_credential(
  p_credential_id uuid,
  p_user_id uuid,
  p_secret_ciphertext bytea,
  p_encrypted_dek bytea,
  p_kms_key_id text,
  p_encryption_version smallint,
  p_last_verified_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_credential_id uuid;
begin
  update public.provider_credentials
  set
    status = 'active',
    secret_ciphertext = p_secret_ciphertext,
    encrypted_dek = p_encrypted_dek,
    kms_key_id = p_kms_key_id,
    encryption_version = p_encryption_version,
    last_verified_at = p_last_verified_at,
    reconcile_after = null,
    last_error_code = null,
    updated_at = p_last_verified_at
  where id = p_credential_id
    and user_id = p_user_id
    and provider = 'openrouter'
    and origin = 'user_oauth'
    and status = 'pending'
  returning id into v_credential_id;

  if v_credential_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'OPENROUTER_PENDING_CREDENTIAL_NOT_FOUND';
  end if;

  insert into public.ai_funding_preferences (
    user_id,
    funding_source,
    updated_at
  )
  values (
    p_user_id,
    'user_openrouter',
    p_last_verified_at
  )
  on conflict (user_id)
  do update set
    funding_source = excluded.funding_source,
    updated_at = excluded.updated_at;

  return v_credential_id;
end;
$$;

revoke execute on function public.activate_openrouter_oauth_credential(
  uuid, uuid, bytea, bytea, text, smallint, timestamptz
) from public, anon, authenticated;

grant execute on function public.activate_openrouter_oauth_credential(
  uuid, uuid, bytea, bytea, text, smallint, timestamptz
) to service_role;

comment on function public.activate_openrouter_oauth_credential(
  uuid, uuid, bytea, bytea, text, smallint, timestamptz
) is
  'Service-role-only atomic OpenRouter OAuth credential activation and funding selection.';
