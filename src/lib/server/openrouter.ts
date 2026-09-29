/**
 * OpenRouter API integration
 * - Handles API calls to OpenRouter
 * - Never exposes API key to client
 * - Implements timeout and error handling
 */

import {
  OPENROUTER_MAX_TOKENS,
  OPENROUTER_TIMEOUT_MS,
} from "@/lib/arena/constants";
import { ApiError } from "./utils";
import type { OpenRouterUsageTelemetryContext } from "./openrouter-usage";
import type { OpenRouterGatewayCredentialContext } from "./openrouter-gateway";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  usage?: {
    include: true;
  };
}

interface OpenRouterResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    is_byok?: boolean;
  };
}

interface OpenRouterErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

interface OpenRouterStreamChunk {
  id?: string;
  model?: string;
  choices?: {
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    cost?: number;
    is_byok?: boolean;
  };
}

/**
 * Get OpenRouter API key from environment
 * @throws Error if API key is not configured
 */
export function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new ApiError(
      503,
      "AI_SERVICE_NOT_CONFIGURED",
      "AI service is not configured. Please contact the project owner."
    );
  }
  return apiKey;
}

const OPENROUTER_UNSAFE_HEADER_VALUE = /[\u0000-\u001F\u007F]/;

function normalizeOpenRouterApiKey(apiKey: string): string {
  const normalized = apiKey.trim();
  if (!normalized || OPENROUTER_UNSAFE_HEADER_VALUE.test(normalized)) {
    throw new ApiError(
      503,
      "AI_CREDENTIAL_UNAVAILABLE",
      "AI provider credential is unavailable."
    );
  }
  return normalized;
}

function logOpenRouterTransportFailure(
  operation: "fetch" | "stream",
  error: unknown
): void {
  console.error("[OpenRouter] transport failure", {
    operation,
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
}

function getOpenRouterTimeoutMs(): number {
  const timeoutFromEnv = process.env.MODEL_TIMEOUT_MS;
  if (!timeoutFromEnv) {
    return OPENROUTER_TIMEOUT_MS;
  }

  const parsedTimeout = Number(timeoutFromEnv);
  if (!Number.isFinite(parsedTimeout) || parsedTimeout <= 0) {
    return OPENROUTER_TIMEOUT_MS;
  }

  return parsedTimeout;
}

function getOpenRouterMaxTokens(): number {
  const maxTokensFromEnv = process.env.OPENROUTER_MAX_TOKENS;
  if (!maxTokensFromEnv) {
    return OPENROUTER_MAX_TOKENS;
  }

  const parsedMaxTokens = Number(maxTokensFromEnv);
  if (!Number.isFinite(parsedMaxTokens) || parsedMaxTokens <= 0) {
    return OPENROUTER_MAX_TOKENS;
  }

  return Math.floor(parsedMaxTokens);
}

async function readOpenRouterJson(
  response: Response
): Promise<OpenRouterResponse | OpenRouterErrorResponse | null> {
  try {
    return (await response.json()) as OpenRouterResponse | OpenRouterErrorResponse;
  } catch {
    return null;
  }
}

function getOpenRouterErrorCode(
  data: OpenRouterResponse | OpenRouterErrorResponse | null
): string | undefined {
  const errorData = data as OpenRouterErrorResponse | null;
  const rawCode = errorData?.error?.code;

  return rawCode === undefined ? undefined : String(rawCode);
}

function logOpenRouterDiagnostic({
  modelId,
  status,
  statusText,
  errorCode,
  latencyMs,
}: {
  modelId: string;
  status: number;
  statusText: string;
  errorCode?: string;
  latencyMs: number;
}): void {
  if (status < 400) return;

  console.warn("[OpenRouter]", {
    modelId,
    status,
    statusText,
    errorCode: errorCode ?? null,
    latencyMs,
  });
}

export type ModelCostSource = "provider_usage" | "unknown";

export type ModelUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  costSource: ModelCostSource;
  providerIsByok: boolean | null;
};

export type OpenRouterCallResult = {
  text: string;
  latencyMs: number;
  usage: ModelUsage;
  providerRequestId: string | null;
  providerModelId: string | null;
};

export type ModelResult =
  | ({ success: true } & OpenRouterCallResult)
  | { success: false; errorCode: string; errorMessage: string };

export type OpenRouterGatewayCallOptions = {
  systemPrompt?: string;
  telemetry?: OpenRouterUsageTelemetryContext;
  signal?: AbortSignal;
  credential?: OpenRouterGatewayCredentialContext;
};

export async function fetchOpenRouterResponse(
  prompt: string,
  modelId: string,
  options?: OpenRouterGatewayCallOptions
): Promise<OpenRouterCallResult> {
  const {
    executeOpenRouterText,
    resolveLegacyPlatformOpenRouterCredential,
  } = await import("./openrouter-gateway");

  return executeOpenRouterText({
    prompt,
    modelId,
    systemPrompt: options?.systemPrompt,
    credential:
      options?.credential ?? resolveLegacyPlatformOpenRouterCredential(),
    telemetry: options?.telemetry,
  });
}

export async function fetchOpenRouterResponseWithApiKey(
  apiKey: string,
  prompt: string,
  modelId: string,
  options?: { systemPrompt?: string }
): Promise<OpenRouterCallResult> {
  const normalizedApiKey = normalizeOpenRouterApiKey(apiKey);

  const messages: OpenRouterRequest["messages"] = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  const request: OpenRouterRequest = {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: getOpenRouterMaxTokens(),
    usage: { include: true },
  };

  const controller = new AbortController();
  const timeoutMs = getOpenRouterTimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedApiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    const data = await readOpenRouterJson(response);
    const latencyMs = Date.now() - startTime;
    const providerErrorCode = getOpenRouterErrorCode(data);

    logOpenRouterDiagnostic({
      modelId,
      status: response.status,
      statusText: response.statusText,
      errorCode: providerErrorCode,
      latencyMs,
    });

    if (!response.ok) {
      const errorData = data as OpenRouterErrorResponse | null;
      const errorMessage =
        errorData?.error?.message || `OpenRouter API returned ${response.status}`;
      const errorCode = providerErrorCode || "OPENROUTER_ERROR";

      if (response.status === 401 || response.status === 403) {
        throw new ApiError(403, "AUTH_ERROR", "AI provider authentication failed.");
      }
      if (response.status === 402) {
        throw new ApiError(402, "INSUFFICIENT_CREDITS", "AI provider account has insufficient credits.");
      }
      if (response.status === 429) {
        throw new ApiError(429, "RATE_LIMIT", "OpenRouter rate limit exceeded. Please try again later.");
      }
      if (response.status >= 500) {
        throw new ApiError(502, errorCode, "AI provider service error. Please try again.");
      }
      if (!data) {
        throw new ApiError(502, "INVALID_RESPONSE", "AI provider returned a non-JSON error response.");
      }
      throw new ApiError(response.status, errorCode, errorMessage);
    }

    if (!data) {
      throw new ApiError(502, "INVALID_RESPONSE", "AI provider returned a non-JSON response.");
    }

    const responseData = data as OpenRouterResponse;
    const content = responseData.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new ApiError(502, "INVALID_RESPONSE", "AI provider returned an empty response.");
    }

    return {
      text: content,
      latencyMs,
      usage: normalizeOpenRouterUsage(responseData.usage),
      providerRequestId:
        typeof responseData.id === "string" && responseData.id.trim()
          ? responseData.id
          : null,
      providerModelId:
        typeof responseData.model === "string" && responseData.model.trim()
          ? responseData.model
          : null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "TIMEOUT", `AI provider request timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    logOpenRouterTransportFailure("fetch", error);
    throw new ApiError(502, "NETWORK_ERROR", "Failed to connect to OpenRouter. Please try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildOpenRouterRequest(
  prompt: string,
  modelId: string,
  options?: { systemPrompt?: string; stream?: boolean }
): OpenRouterRequest {
  const messages: OpenRouterRequest["messages"] = [];
  if (options?.systemPrompt) {
    messages.push({ role: "system", content: options.systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  return {
    model: modelId,
    messages,
    temperature: 0.7,
    max_tokens: getOpenRouterMaxTokens(),
    stream: options?.stream,
    usage: { include: true },
  };
}

function parseSseDataLines(rawEvent: string): string | null {
  const dataLines = rawEvent
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart());

  return dataLines.length > 0 ? dataLines.join("\n") : null;
}

export function normalizeOpenRouterUsage(
  usage: unknown
): ModelUsage {
  const normalized =
    typeof usage === "object" && usage !== null
      ? (usage as OpenRouterResponse["usage"])
      : undefined;
  const rawCost = normalized?.cost;
  const costUsd =
    typeof rawCost === "number" && Number.isFinite(rawCost) && rawCost >= 0
      ? rawCost
      : null;

  return {
    inputTokens: normalized?.prompt_tokens ?? null,
    outputTokens: normalized?.completion_tokens ?? null,
    totalTokens: normalized?.total_tokens ?? null,
    costUsd,
    costSource: costUsd === null ? "unknown" : "provider_usage",
    providerIsByok:
      typeof normalized?.is_byok === "boolean" ? normalized.is_byok : null,
  };
}

export async function streamOpenRouterResponse(
  prompt: string,
  modelId: string,
  onToken: (token: string) => void | Promise<void>,
  options?: OpenRouterGatewayCallOptions
): Promise<OpenRouterCallResult> {
  const {
    resolveLegacyPlatformOpenRouterCredential,
    streamOpenRouterText,
  } = await import("./openrouter-gateway");

  return streamOpenRouterText({
    prompt,
    modelId,
    onToken,
    systemPrompt: options?.systemPrompt,
    credential:
      options?.credential ?? resolveLegacyPlatformOpenRouterCredential(),
    telemetry: options?.telemetry,
    signal: options?.signal,
  });
}

export async function streamOpenRouterResponseWithApiKey(
  apiKey: string,
  prompt: string,
  modelId: string,
  onToken: (token: string) => void | Promise<void>,
  options?: { systemPrompt?: string; signal?: AbortSignal }
): Promise<OpenRouterCallResult> {
  const normalizedApiKey = normalizeOpenRouterApiKey(apiKey);

  const request = buildOpenRouterRequest(prompt, modelId, {
    systemPrompt: options?.systemPrompt,
    stream: true,
  });

  const controller = new AbortController();
  const timeoutMs = getOpenRouterTimeoutMs();
  const externalSignal = options?.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  }

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${normalizedApiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const data = await readOpenRouterJson(response);
      const latencyMs = Date.now() - startTime;
      const providerErrorCode = getOpenRouterErrorCode(data);

      logOpenRouterDiagnostic({
        modelId,
        status: response.status,
        statusText: response.statusText,
        errorCode: providerErrorCode,
        latencyMs,
      });

      const errorData = data as OpenRouterErrorResponse | null;
      const errorMessage =
        errorData?.error?.message || `OpenRouter API returned ${response.status}`;
      const errorCode = providerErrorCode || "OPENROUTER_ERROR";

      if (response.status === 401 || response.status === 403) {
        throw new ApiError(403, "AUTH_ERROR", "AI provider authentication failed.");
      }
      if (response.status === 402) {
        throw new ApiError(402, "INSUFFICIENT_CREDITS", "AI provider account has insufficient credits.");
      }
      if (response.status === 429) {
        throw new ApiError(429, "RATE_LIMIT", "OpenRouter rate limit exceeded. Please try again later.");
      }
      if (response.status >= 500) {
        throw new ApiError(502, errorCode, "AI provider service error. Please try again.");
      }
      throw new ApiError(response.status, errorCode, errorMessage);
    }

    if (!response.body) {
      throw new ApiError(502, "INVALID_RESPONSE", "AI provider returned an empty stream.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: ModelUsage = normalizeOpenRouterUsage(undefined);
    let providerRequestId: string | null = null;
    let providerModelId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        if (!rawEvent.trim() || rawEvent.trimStart().startsWith(":")) {
          continue;
        }

        const dataLine = parseSseDataLines(rawEvent);
        if (!dataLine || dataLine === "[DONE]") {
          continue;
        }

        let chunk: OpenRouterStreamChunk;
        try {
          chunk = JSON.parse(dataLine) as OpenRouterStreamChunk;
        } catch {
          continue;
        }

        if (typeof chunk.id === "string" && chunk.id.trim()) {
          providerRequestId = chunk.id;
        }
        if (typeof chunk.model === "string" && chunk.model.trim()) {
          providerModelId = chunk.model;
        }
        if (chunk.usage) {
          usage = normalizeOpenRouterUsage(chunk.usage);
        }

        const token =
          chunk.choices?.[0]?.delta?.content ??
          chunk.choices?.[0]?.message?.content ??
          "";

        if (token) {
          text += token;
          await onToken(token);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    const trimmedText = text.trim();
    if (!trimmedText) {
      throw new ApiError(502, "INVALID_RESPONSE", "AI provider returned an empty response.");
    }

    return {
      text: trimmedText,
      latencyMs,
      usage,
      providerRequestId,
      providerModelId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (externalSignal?.aborted) {
        throw new ApiError(499, "ABORTED", "AI provider request was aborted.");
      }
      throw new ApiError(504, "TIMEOUT", `AI provider request timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    logOpenRouterTransportFailure("stream", error);
    throw new ApiError(502, "NETWORK_ERROR", "Failed to stream from OpenRouter. Please try again.");
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export async function fetchMultipleResponses(
  prompt: string,
  modelIds: string[],
  options?: OpenRouterGatewayCallOptions
): Promise<ModelResult[]> {
  const promises = modelIds.map(async (modelId): Promise<ModelResult> => {
    try {
      const {
        text,
        latencyMs,
        usage,
        providerRequestId,
        providerModelId,
      } = await fetchOpenRouterResponse(prompt, modelId, options);
      return {
        success: true,
        text,
        latencyMs,
        usage,
        providerRequestId,
        providerModelId,
      };
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.errorCode : "UNKNOWN_ERROR";
      const errorMessage = error instanceof ApiError
        ? error.message
        : "Failed to get response from this model";
      return { success: false, errorCode, errorMessage };
    }
  });

  return Promise.all(promises);
}
