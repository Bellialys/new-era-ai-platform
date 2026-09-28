import type { SupabaseClient } from "@supabase/supabase-js";
import { OpenRouterCredentialError } from "./openrouter-credentials";

export type ResolvedAiFunding =
  | {
      billingSource: "platform";
      credentialId: null;
    }
  | {
      billingSource: "user_openrouter";
      credentialId: string;
    };

export async function resolveAiFunding(
  supabase: SupabaseClient,
  userId: string
): Promise<ResolvedAiFunding> {
  const { data: preference, error: preferenceError } = await supabase
    .from("ai_funding_preferences")
    .select("funding_source")
    .eq("user_id", userId)
    .maybeSingle();

  if (preferenceError) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not resolve AI funding preference."
    );
  }

  if (preference?.funding_source !== "user_openrouter") {
    return {
      billingSource: "platform",
      credentialId: null,
    };
  }

  const { data: credential, error: credentialError } = await supabase
    .from("provider_credentials")
    .select("id, secret_ciphertext, encrypted_dek, kms_key_id")
    .eq("user_id", userId)
    .eq("provider", "openrouter")
    .eq("origin", "user_oauth")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (credentialError) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CREDENTIAL_STORE_FAILED",
      "Could not resolve OpenRouter credential."
    );
  }

  if (
    !credential ||
    typeof credential.id !== "string" ||
    !credential.secret_ciphertext ||
    !credential.encrypted_dek ||
    typeof credential.kms_key_id !== "string" ||
    !credential.kms_key_id.trim()
  ) {
    throw new OpenRouterCredentialError(
      "OPENROUTER_CONNECTION_REQUIRED",
      "Connect OpenRouter before selecting user-funded AI requests."
    );
  }

  return {
    billingSource: "user_openrouter",
    credentialId: credential.id,
  };
}
