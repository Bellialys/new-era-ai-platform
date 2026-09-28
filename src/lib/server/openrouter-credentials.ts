import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  encryptCredentialSecret,
  type CredentialDataKeyProvider,
} from "./credential-crypto";

export type OpenRouterIntegrationStatus = {
  connected: boolean;
  credentialId: string | null;
  credentialStatus: string | null;
  safeFingerprint: string | null;
  lastVerifiedAt: string | null;
  fundingSource: "platform" | "user_openrouter";
};

export class OpenRouterCredentialError extends Error {
  constructor(
    public readonly code:
      | "OPENROUTER_ALREADY_CONNECTED"
      | "OPENROUTER_CONNECTION_IN_PROGRESS"
      | "OPENROUTER_CREDENTIAL_STORE_FAILED"
      | "OPENROUTER_CONNECTION_REQUIRED",
    message: string
  ) {
    super(message);
    this.name = "OpenRouterCredentialError";
  }
}

const OAUTH_PENDING_TTL_MS = 15 * 60 * 1000;

function byteaHex(value: Uint8Array): string {
  return "\\x" + Buffer.from(value).toString("hex");
}

async function expireStaleOpenRouterOAuthPendingCredential(
  supabase: SupabaseClient,
  userId: string,
  nowIso: string
): Promise<void> {
  const { error } = await supabase
    .from("provider_credentials")
    .update({
      status: "error",
      secret_ciphertext: null,
      encrypted_dek: null,
      kms_key_id: null,
      reconcile_after: null,
      last_error_code: "OAUTH_PENDING_EXPIRED",
      updated_at: nowIso,
    })
    .eq("user_id", userId)
    .eq("provider", "openrouter")
    .eq("origin", "user_oauth")
    .eq("status", "pending")
    .lte("reconcile_after", nowIso);

  if (error) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not reconcile an unfinished OpenRouter connection."
    );
  }
}

export function hashOpenRouterKey(apiKey: string): {
  providerKeyHash: string;
  safeFingerprint: string;
} {
  const providerKeyHash = createHash("sha256").update(apiKey, "utf8").digest("hex");
  return {
    providerKeyHash,
    safeFingerprint:
      providerKeyHash.slice(0, 8) + "…" + providerKeyHash.slice(-4),
  };
}

async function readFundingSource(
  supabase: SupabaseClient,
  userId: string
): Promise<"platform" | "user_openrouter"> {
  const { data, error } = await supabase
    .from("ai_funding_preferences")
    .select("funding_source")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not read AI funding preference."
    );
  }

  return data?.funding_source === "user_openrouter"
    ? "user_openrouter"
    : "platform";
}

export async function getOpenRouterIntegrationStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<OpenRouterIntegrationStatus> {
  const [{ data, error }, fundingSource] = await Promise.all([
    supabase
      .from("provider_credentials")
      .select("id, status, safe_fingerprint, last_verified_at, created_at")
      .eq("user_id", userId)
      .eq("provider", "openrouter")
      .eq("origin", "user_oauth")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    readFundingSource(supabase, userId),
  ]);

  if (error) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not read OpenRouter connection status."
    );
  }

  return {
    connected: data?.status === "active",
    credentialId: typeof data?.id === "string" ? data.id : null,
    credentialStatus: typeof data?.status === "string" ? data.status : null,
    safeFingerprint:
      typeof data?.safe_fingerprint === "string" ? data.safe_fingerprint : null,
    lastVerifiedAt:
      typeof data?.last_verified_at === "string" ? data.last_verified_at : null,
    fundingSource,
  };
}

export async function persistOpenRouterOAuthCredential(input: {
  supabase: SupabaseClient;
  userId: string;
  apiKey: string;
  dataKeyProvider: CredentialDataKeyProvider;
}): Promise<{
  credentialId: string;
  safeFingerprint: string;
  fundingSource: "user_openrouter";
}> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "OpenRouter credential is empty."
    );
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  await expireStaleOpenRouterOAuthPendingCredential(
    input.supabase,
    input.userId,
    nowIso
  );

  const existing = await getOpenRouterIntegrationStatus(input.supabase, input.userId);
  if (existing.connected) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_ALREADY_CONNECTED",
      "OpenRouter is already connected."
    );
  }
  if (existing.credentialStatus === "pending") {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CONNECTION_IN_PROGRESS",
      "An OpenRouter connection is already being finalized."
    );
  }

  const credentialId = randomUUID();
  const { providerKeyHash, safeFingerprint } = hashOpenRouterKey(apiKey);

  const { error: pendingError } = await input.supabase
    .from("provider_credentials")
    .insert({
      id: credentialId,
      user_id: input.userId,
      provider: "openrouter",
      origin: "user_oauth",
      status: "pending",
      provider_key_hash: providerKeyHash,
      safe_fingerprint: safeFingerprint,
      reconcile_after: new Date(nowMs + OAUTH_PENDING_TTL_MS).toISOString(),
    });

  if (pendingError) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not prepare encrypted OpenRouter credential storage."
    );
  }

  try {
    const envelope = await encryptCredentialSecret(
      apiKey,
      input.dataKeyProvider,
      {
        credentialId,
        provider: "openrouter",
        origin: "user_oauth",
      }
    );

    const { data: activated, error: activationError } = await input.supabase
      .from("provider_credentials")
      .update({
        status: "active",
        secret_ciphertext: byteaHex(envelope.secretCiphertext),
        encrypted_dek: byteaHex(envelope.encryptedDek),
        kms_key_id: envelope.kmsKeyId,
        encryption_version: envelope.encryptionVersion,
        last_verified_at: new Date().toISOString(),
        reconcile_after: null,
        last_error_code: null,
      })
      .eq("id", credentialId)
      .eq("user_id", input.userId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (activationError || activated?.id !== credentialId) {
      throw new OpenRouterCredentialError(
        "OPENROUTER_CREDENTIAL_STORE_FAILED",
        "Could not activate encrypted OpenRouter credential."
      );
    }

    const { error: fundingError } = await input.supabase
      .from("ai_funding_preferences")
      .upsert(
        {
          user_id: input.userId,
          funding_source: "user_openrouter",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (fundingError) {
      throw new OpenRouterCredentialError(
        "OPENROUTER_CREDENTIAL_STORE_FAILED",
        "Could not switch AI funding to the connected OpenRouter account."
      );
    }

    return {
      credentialId,
      safeFingerprint,
      fundingSource: "user_openrouter",
    };
  } catch (error) {
    await input.supabase
      .from("provider_credentials")
      .delete()
      .eq("id", credentialId)
      .eq("user_id", input.userId)
      .eq("status", "pending");

    if (error instanceof OpenRouterCredentialError) {
      throw error;
    }

    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Encrypted OpenRouter credential persistence failed."
    );
  }
}

export async function disconnectOpenRouterCredential(input: {
  supabase: SupabaseClient;
  userId: string;
}): Promise<void> {
  const now = new Date().toISOString();

  // Revoke/clear the credential first. Activation only matches status=pending,
  // so a concurrent callback cannot resurrect a credential after disconnect.
  const { error: disconnectError } = await input.supabase
    .from("provider_credentials")
    .update({
      status: "revoked",
      secret_ciphertext: null,
      encrypted_dek: null,
      kms_key_id: null,
      reconcile_after: null,
      revoked_at: now,
      updated_at: now,
    })
    .eq("user_id", input.userId)
    .eq("provider", "openrouter")
    .eq("origin", "user_oauth")
    .in("status", ["pending", "active", "error"]);

  if (disconnectError) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not disconnect OpenRouter."
    );
  }

  const { error: fundingError } = await input.supabase
    .from("ai_funding_preferences")
    .upsert(
      {
        user_id: input.userId,
        funding_source: "platform",
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  if (fundingError) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "OpenRouter was disconnected but AI funding preference could not be reset."
    );
  }
}
