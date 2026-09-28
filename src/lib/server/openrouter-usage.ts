import type { OpenRouterGatewayResult } from "./openrouter-gateway";

export interface OpenRouterUsageEventInput {
  userId: string | null;
  guestId: string | null;
  modeSlug: string;
  requestKind: string;
  requestedModelId: string;
  result: OpenRouterGatewayResult;
}

export interface OpenRouterUsageEvent {
  userId: string | null;
  guestId: string | null;
  modeSlug: string;
  modelKey: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
  costUsd: number | null;
  errorCode: null;
  billingSource: OpenRouterGatewayResult["billingSource"];
  credentialId: string | null;
  providerRequestId: string | null;
  providerModelId: string | null;
  providerUsage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
    costUsd: number | null;
    costSource: OpenRouterGatewayResult["usage"]["costSource"];
    providerIsByok: boolean | null;
    providerModelId: string | null;
  };
  providerIsByok: boolean | null;
  costSource: OpenRouterGatewayResult["usage"]["costSource"];
  currency: "USD";
  requestKind: string;
}

export class OpenRouterUsageContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterUsageContractError";
  }
}

function requireLabel(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new OpenRouterUsageContractError(`${field} is required.`);
  }
  return normalized;
}

function assertActualCostContract(
  result: Pick<OpenRouterGatewayResult, "usage">
): void {
  const { costSource, costUsd } = result.usage;

  if (costSource === "provider_usage" && costUsd === null) {
    throw new OpenRouterUsageContractError(
      "Provider-reported cost source requires a numeric cost."
    );
  }

  if (costSource === "unknown" && costUsd !== null) {
    throw new OpenRouterUsageContractError(
      "Unknown cost source cannot carry an actual cost."
    );
  }
}

/**
 * Maps a successful unified-gateway result to the safe Stage 3.3 telemetry
 * contract.
 *
 * The mapper is intentionally allowlist-based. It never spreads the source
 * result, so accidental extra properties such as plaintext credentials cannot
 * enter telemetry. Persistence is a separate concern and is not performed here.
 */
export function toOpenRouterUsageEvent(
  input: OpenRouterUsageEventInput
): OpenRouterUsageEvent {
  const modeSlug = requireLabel(input.modeSlug, "modeSlug");
  const requestKind = requireLabel(input.requestKind, "requestKind");
  const modelKey = requireLabel(input.requestedModelId, "requestedModelId");

  assertActualCostContract(input.result);

  const {
    inputTokens,
    outputTokens,
    totalTokens,
    costUsd,
    costSource,
    providerIsByok,
  } = input.result.usage;

  return {
    userId: input.userId,
    guestId: input.guestId,
    modeSlug,
    modelKey,
    promptTokens: inputTokens,
    completionTokens: outputTokens,
    totalTokens,
    latencyMs: input.result.latencyMs,
    costUsd,
    errorCode: null,
    billingSource: input.result.billingSource,
    credentialId: input.result.credentialId,
    providerRequestId: input.result.providerRequestId,
    providerModelId: input.result.providerModelId,
    providerUsage: {
      promptTokens: inputTokens,
      completionTokens: outputTokens,
      totalTokens,
      costUsd,
      costSource,
      providerIsByok,
      providerModelId: input.result.providerModelId,
    },
    providerIsByok,
    costSource,
    currency: "USD",
    requestKind,
  };
}
