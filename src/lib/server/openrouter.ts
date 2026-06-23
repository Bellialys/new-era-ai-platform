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

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
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
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
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

export type ModelUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type ModelResult =
  | { success: true; text: string; latencyMs: number; usage: ModelUsage }
  | { success: false; errorCode: string; errorMessage: string };

export async function fetchOpenRouterResponse(
  prompt: string,
  modelId: string,
  options?: { systemPrompt?: string }
): Promise<{ text: string; latencyMs: number; usage: ModelUsage }> {
  const apiKey = getApiKey();

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
        Authorization: `Bearer ${apiKey}`,
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
      usage: {
        inputTokens: responseData.usage?.prompt_tokens ?? null,
        outputTokens: responseData.usage?.completion_tokens ?? null,
        totalTokens: responseData.usage?.total_tokens ?? null,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "TIMEOUT", `AI provider request timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("OpenRouter fetch error:", error);
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

function toModelUsage(usage: OpenRouterStreamChunk["usage"]): ModelUsage {
  return {
    inputTokens: usage?.prompt_tokens ?? null,
    outputTokens: usage?.completion_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

export async function streamOpenRouterResponse(
  prompt: string,
  modelId: string,
  onToken: (token: string) => void | Promise<void>,
  options?: { systemPrompt?: string }
): Promise<{ text: string; latencyMs: number; usage: ModelUsage }> {
  const apiKey = getApiKey();
  const request = buildOpenRouterRequest(prompt, modelId, {
    systemPrompt: options?.systemPrompt,
    stream: true,
  });

  const controller = new AbortController();
  const timeoutMs = getOpenRouterTimeoutMs();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startTime = Date.now();

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
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
    let usage: ModelUsage = {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
    };

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

        if (chunk.usage) {
          usage = toModelUsage(chunk.usage);
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

    return { text: trimmedText, latencyMs, usage };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(504, "TIMEOUT", `AI provider request timed out after ${timeoutMs}ms.`);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    console.error("OpenRouter stream error:", error);
    throw new ApiError(502, "NETWORK_ERROR", "Failed to stream from OpenRouter. Please try again.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchMultipleResponses(
  prompt: string,
  modelIds: string[],
  options?: { systemPrompt?: string }
): Promise<ModelResult[]> {
  const promises = modelIds.map(async (modelId): Promise<ModelResult> => {
    try {
      const { text, latencyMs, usage } = await fetchOpenRouterResponse(prompt, modelId, options);
      return { success: true, text, latencyMs, usage };
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
