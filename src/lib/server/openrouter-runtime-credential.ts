import type { RequestIdentity } from "./auth";
import { createAwsKmsDataKeyProviderFromEnv } from "./aws-kms-data-key-provider";
import { decryptCredentialSecret } from "./credential-crypto";
import { resolveAiFunding } from "./funding-resolver";
import { getApiKey } from "./openrouter";
import type { OpenRouterGatewayCredentialContext } from "./openrouter-gateway";
import { isOpenRouterOAuthBetaAvailable } from "./openrouter-integration-config";
import { getSupabaseServerClient } from "./supabase";
import { ApiError } from "./utils";

type CredentialRow = {
  id: string;
  secret_ciphertext: unknown;
  encrypted_dek: unknown;
  kms_key_id: unknown;
  encryption_version: unknown;
};

function parseBytea(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) {
    return value.byteLength > 0 ? new Uint8Array(value) : null;
  }

  if (
    typeof value === "string" &&
    /^\\x(?:[0-9a-fA-F]{2})+$/.test(value)
  ) {
    return new Uint8Array(Buffer.from(value.slice(2), "hex"));
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        Number.isInteger(item) &&
        typeof item === "number" &&
        item >= 0 &&
        item <= 255
    )
  ) {
    return Uint8Array.from(value as number[]);
  }

  return null;
}

function platformCredential(): OpenRouterGatewayCredentialContext {
  return {
    billingSource: "platform",
    credentialId: null,
    apiKey: getApiKey(),
  };
}

function unavailableCredential(): ApiError {
  return new ApiError(
    503,
    "AI_CREDENTIAL_UNAVAILABLE",
    "Connected OpenRouter credential is unavailable."
  );
}

export async function resolveOpenRouterRuntimeCredential(
  identity: RequestIdentity
): Promise<OpenRouterGatewayCredentialContext> {
  if (
    identity.kind !== "user" ||
    !isOpenRouterOAuthBetaAvailable()
  ) {
    return platformCredential();
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new ApiError(
      503,
      "PERSISTENCE_UNAVAILABLE",
      "AI credential persistence is unavailable."
    );
  }

  let funding;
  try {
    funding = await resolveAiFunding(supabase, identity.userId);
  } catch {
    throw unavailableCredential();
  }

  if (funding.billingSource === "platform") {
    return platformCredential();
  }

  const { data, error } = await supabase
    .from("provider_credentials")
    .select(
      "id, secret_ciphertext, encrypted_dek, kms_key_id, encryption_version"
    )
    .eq("id", funding.credentialId)
    .eq("user_id", identity.userId)
    .eq("provider", "openrouter")
    .eq("origin", "user_oauth")
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) {
    throw unavailableCredential();
  }

  const row = data as CredentialRow;
  const secretCiphertext = parseBytea(row.secret_ciphertext);
  const encryptedDek = parseBytea(row.encrypted_dek);
  const kmsKeyId =
    typeof row.kms_key_id === "string" ? row.kms_key_id.trim() : "";
  const encryptionVersion =
    typeof row.encryption_version === "number"
      ? row.encryption_version
      : Number(row.encryption_version);

  if (
    row.id !== funding.credentialId ||
    !secretCiphertext ||
    !encryptedDek ||
    !kmsKeyId ||
    !Number.isInteger(encryptionVersion) ||
    encryptionVersion <= 0
  ) {
    throw unavailableCredential();
  }

  let apiKey: string;
  try {
    apiKey = await decryptCredentialSecret(
      {
        secretCiphertext,
        encryptedDek,
        kmsKeyId,
        encryptionVersion,
      },
      createAwsKmsDataKeyProviderFromEnv(),
      {
        credentialId: funding.credentialId,
        provider: "openrouter",
        origin: "user_oauth",
      }
    );
  } catch {
    throw unavailableCredential();
  }

  if (!apiKey.trim()) {
    throw unavailableCredential();
  }

  return {
    billingSource: "user_openrouter",
    credentialId: funding.credentialId,
    apiKey,
  };
}
