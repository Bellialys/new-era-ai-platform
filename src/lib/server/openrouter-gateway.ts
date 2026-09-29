import {
  isAiFundingSource,
  type AiFundingSource,
} from "./provider-credentials";
import {
  fetchOpenRouterResponseWithApiKey,
  getApiKey,
  normalizeOpenRouterUsage,
  streamOpenRouterResponseWithApiKey,
  type ModelUsage,
  type OpenRouterCallResult,
} from "./openrouter";
import { OPENROUTER_IMAGE_API_URL } from "@/lib/arena/constants";
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

export interface OpenRouterImageGatewayConsumeResult<T> {
  value: T;
  usage?: ModelUsage;
  providerRequestId?: string | null;
  providerModelId?: string | null;
  errorCode?: string | null;
}

export interface OpenRouterImageGatewayRequest<T> {
  prompt: string;
  modelId: string;
  credential: OpenRouterGatewayCredentialContext;
  telemetry?: OpenRouterUsageTelemetryContext;
  timeoutMs: number;
  consumeResponse: (
    response: Response
  ) => Promise<OpenRouterImageGatewayConsumeResult<T>>;
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
  request: Pick<OpenRouterGatewayRequest, "modelId" | "telemetry">,
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

async function cancelGatewayResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Provider body cancellation is best effort after the response is rejected.
  }
}

function emptyGatewayUsage(): ModelUsage {
  return normalizeOpenRouterUsage(undefined);
}

/**
 * Image Arena provider boundary. The route owns bounded decoding/storage rules,
 * while this function owns credential normalization, provider transport,
 * funding attribution and per-provider-call usage telemetry.
 */
export async function executeOpenRouterImage<T>(
  request: OpenRouterImageGatewayRequest<T>
): Promise<T> {
  const credential = normalizeCredentialContext(request.credential);
  const startedAt = Date.now();

  try {
    const response = await fetch(OPENROUTER_IMAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credential.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify({
        model: request.modelId,
        prompt: request.prompt,
        n: 1,
        aspect_ratio: "1:1",
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    });

    if (!response.ok) {
      await cancelGatewayResponseBody(response);
      console.warn("[OpenRouter image] provider request failed", {
        modelId: request.modelId,
        status: response.status,
      });

      const error =
        response.status === 401 || response.status === 403
          ? new ApiError(
              403,
              "AUTH_ERROR",
              "AI provider authentication failed."
            )
          : response.status === 402
            ? new ApiError(
                402,
                "INSUFFICIENT_CREDITS",
                "AI provider account has insufficient credits."
              )
            : response.status === 429
              ? new ApiError(
                  429,
                  "RATE_LIMIT",
                  "AI provider rate limit exceeded."
                )
              : new ApiError(
                  502,
                  "IMAGE_PROVIDER_ERROR",
                  "Image provider request failed."
                );

      await recordGatewayUsage(
        request,
        credential,
        null,
        Date.now() - startedAt,
        error.errorCode
      );
      throw error;
    }

    const consumed = await request.consumeResponse(response);
    const latencyMs = Date.now() - startedAt;
    const providerResult: OpenRouterCallResult = {
      text: "",
      latencyMs,
      usage: consumed.usage ?? emptyGatewayUsage(),
      providerRequestId: consumed.providerRequestId ?? null,
      providerModelId: consumed.providerModelId ?? null,
    };

    await recordGatewayUsage(
      request,
      credential,
      providerResult,
      latencyMs,
      consumed.errorCode ?? null
    );

    return consumed.value;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const isTimeout =
      error instanceof Error && error.name === "TimeoutError";
    const apiError = isTimeout
      ? new ApiError(
          504,
          "TIMEOUT",
          "Image provider request timed out."
        )
      : new ApiError(
          502,
          "NETWORK_ERROR",
          "Image provider request failed."
        );

    console.warn("[OpenRouter image] transport failure", {
      modelId: request.modelId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    await recordGatewayUsage(
      request,
      credential,
      null,
      Date.now() - startedAt,
      apiError.errorCode
    );
    throw apiError;
  }
}
