import {
  isAiFundingSource,
  type AiFundingSource,
} from "./provider-credentials";
import {
  fetchOpenRouterResponseWithApiKey,
  getApiKey,
  streamOpenRouterResponseWithApiKey,
  type OpenRouterCallResult,
} from "./openrouter";
import {
  recordOpenRouterUsageEventBestEffort,
  type OpenRouterUsageTelemetryContext,
} from "./openrouter-usage";
import { ApiError } from "./utils";

export interface OpenRouterGatewayCredentialContext {
  billingSource: AiFundingSource;
  credentialId: string | null;
  apiKey: string;
}

export interface OpenRouterGatewayRequest {
  prompt: string;
  modelId: string;
  systemPrompt?: string;
  credential: OpenRouterGatewayCredentialContext;
  telemetry?: OpenRouterUsageTelemetryContext;
}

export interface OpenRouterGatewayStreamRequest
  extends OpenRouterGatewayRequest {
  onToken: (token: string) => void | Promise<void>;
  signal?: AbortSignal;
}

export type OpenRouterGatewayResult = OpenRouterCallResult & {
  billingSource: AiFundingSource;
  credentialId: string | null;
};

export class OpenRouterGatewayConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenRouterGatewayConfigurationError";
  }
}

export function resolveLegacyPlatformOpenRouterCredential(): OpenRouterGatewayCredentialContext {
  return {
    billingSource: "platform",
    credentialId: null,
    apiKey: getApiKey(),
  };
}

function safeGatewayErrorCode(error: unknown): string {
  return error instanceof ApiError ? error.errorCode : "UNKNOWN_ERROR";
}

async function recordGatewayUsage(
  request: OpenRouterGatewayRequest,
  credential: Pick<OpenRouterGatewayCredentialContext, "billingSource" | "credentialId">,
  result: OpenRouterCallResult | null,
  latencyMs: number,
  errorCode: string | null
): Promise<void> {
  if (!request.telemetry) return;

  await recordOpenRouterUsageEventBestEffort({
    ...request.telemetry,
    modelKey: request.modelId,
    billingSource: credential.billingSource,
    credentialId: credential.credentialId,
    result,
    latencyMs,
    errorCode,
  });
}

function normalizeCredentialContext(
  context: OpenRouterGatewayCredentialContext
): OpenRouterGatewayCredentialContext {
  if (!isAiFundingSource(context.billingSource)) {
    throw new OpenRouterGatewayConfigurationError(
      "Unsupported AI funding source."
    );
  }

  const apiKey = context.apiKey.trim();
  if (!apiKey || /[\u0000-\u001F\u007F]/.test(apiKey)) {
    throw new OpenRouterGatewayConfigurationError(
      "OpenRouter credential is unavailable."
    );
  }

  const credentialId = context.credentialId?.trim() || null;
  if (context.billingSource === "user_openrouter" && !credentialId) {
    throw new OpenRouterGatewayConfigurationError(
      "User OpenRouter funding requires a credential id."
    );
  }

  return {
    billingSource: context.billingSource,
    credentialId,
    apiKey,
  };
}

function attachFundingMetadata(
  result: OpenRouterCallResult,
  context: Pick<
    OpenRouterGatewayCredentialContext,
    "billingSource" | "credentialId"
  >
): OpenRouterGatewayResult {
  return {
    ...result,
    billingSource: context.billingSource,
    credentialId: context.credentialId,
  };
}

/**
 * Unified Stage 3 text gateway for a credential that has already been resolved
 * and decrypted by a server-side credential layer.
 *
 * This module does not read the database, decrypt KMS envelopes, persist usage,
 * or choose a funding source. Those responsibilities remain separate so API
 * routes cannot influence credential ownership through browser-controlled data.
 */
export async function executeOpenRouterText(
  request: OpenRouterGatewayRequest
): Promise<OpenRouterGatewayResult> {
  const credential = normalizeCredentialContext(request.credential);
  const startedAt = Date.now();

  try {
    const result = await fetchOpenRouterResponseWithApiKey(
      credential.apiKey,
      request.prompt,
      request.modelId,
      request.systemPrompt
        ? { systemPrompt: request.systemPrompt }
        : undefined
    );

    await recordGatewayUsage(
      request,
      credential,
      result,
      result.latencyMs,
      null
    );
    return attachFundingMetadata(result, credential);
  } catch (error) {
    await recordGatewayUsage(
      request,
      credential,
      null,
      Date.now() - startedAt,
      safeGatewayErrorCode(error)
    );
    throw error;
  }
}

/**
 * Streaming equivalent of executeOpenRouterText with the same funding and
 * credential contract.
 */
export async function streamOpenRouterText(
  request: OpenRouterGatewayStreamRequest
): Promise<OpenRouterGatewayResult> {
  const credential = normalizeCredentialContext(request.credential);
  const startedAt = Date.now();

  try {
    const result = await streamOpenRouterResponseWithApiKey(
      credential.apiKey,
      request.prompt,
      request.modelId,
      request.onToken,
      request.systemPrompt || request.signal
        ? {
            systemPrompt: request.systemPrompt,
            signal: request.signal,
          }
        : undefined
    );

    await recordGatewayUsage(
      request,
      credential,
      result,
      result.latencyMs,
      null
    );
    return attachFundingMetadata(result, credential);
  } catch (error) {
    await recordGatewayUsage(
      request,
      credential,
      null,
      Date.now() - startedAt,
      safeGatewayErrorCode(error)
    );
    throw error;
  }
}
