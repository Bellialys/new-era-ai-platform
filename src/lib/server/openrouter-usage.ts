import type { AiFundingSource } from "./provider-credentials";
import type { OpenRouterCallResult } from "./openrouter";
import { getSupabaseServerClient } from "./supabase";
import { withTimeout } from "./utils";

const OPENROUTER_USAGE_WRITE_TIMEOUT_MS = 1_500;

export type OpenRouterUsageRequestKind = "text" | "stream" | "image";

export interface OpenRouterUsageTelemetryContext {
  userId: string | null;
  guestId: string | null;
  modeSlug: string;
  requestKind: OpenRouterUsageRequestKind;
}

export interface OpenRouterUsageEventInput
  extends OpenRouterUsageTelemetryContext {
  modelKey: string;
  billingSource: AiFundingSource;
  credentialId: string | null;
  result: OpenRouterCallResult | null;
  latencyMs: number | null;
  errorCode: string | null;
}

function safeDatabaseErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

export async function recordOpenRouterUsageEventBestEffort(
  input: OpenRouterUsageEventInput
): Promise<void> {
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) return;

    const usage = input.result?.usage;
    const providerUsage = {
      prompt_tokens: usage?.inputTokens ?? null,
      completion_tokens: usage?.outputTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      cost: usage?.costUsd ?? null,
      is_byok: usage?.providerIsByok ?? null,
    };

    const { error } = await withTimeout(
      supabase.from("usage_events").insert({
      user_id: input.userId,
      guest_id: input.guestId,
      mode_slug: input.modeSlug,
      model_key: input.modelKey,
      prompt_tokens: usage?.inputTokens ?? null,
      completion_tokens: usage?.outputTokens ?? null,
      total_tokens: usage?.totalTokens ?? null,
      latency_ms: input.result?.latencyMs ?? input.latencyMs,
      cost_usd: usage?.costUsd ?? null,
      error_code: input.errorCode,
      billing_source: input.billingSource,
      credential_id: input.credentialId,
      provider_request_id: input.result?.providerRequestId ?? null,
      provider_model_key: input.result?.providerModelId ?? null,
      provider_usage: providerUsage,
      provider_is_byok: usage?.providerIsByok ?? null,
      cost_source: usage?.costSource ?? "unknown",
      currency: "USD",
        request_kind: input.requestKind,
      }),
      OPENROUTER_USAGE_WRITE_TIMEOUT_MS,
      "OpenRouter usage telemetry write"
    );

    if (error) {
      console.error("[OpenRouter usage] telemetry insert failed", {
        errorCode: safeDatabaseErrorCode(error),
      });
    }
  } catch (error) {
    console.error("[OpenRouter usage] telemetry write failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
