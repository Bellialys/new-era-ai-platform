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
    message: string;
    type: string;
    code: string;
  };
}

/**
 * Get OpenRouter API key from environment
 * @throws Error if API key is not configured
 */
function getApiKey(): string {
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
  modelId: string
): Promise<{ text: string; latencyMs: number; usage: ModelUsage }> {
  const apiKey = getApiKey();

  const request: OpenRouterRequest = {
    model: modelId,
    messages: [{ role: "user", content: prompt }],
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

    if (!response.ok) {
      const errorData = data as OpenRouterErrorResponse | null;
      const errorMessage =
        errorData?.error?.message || `OpenRouter API returned ${response.status}`;
      const errorCode = errorData?.error?.code || "OPENROUTER_ERROR";

      if (response.status === 401 || response.status === 403) {
        throw new ApiError(403, "AUTH_ERROR", "AI provider authentication failed.");
      }
      if (response.status === 429) {
        throw new ApiError(429, "RATE_LIMIT", "OpenRouter rate limit exceeded. Please try again later.");
      }
      if (response.status >= 500) {
        throw new ApiError(502, errorCode, "AI provider service error. Please try again.");
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
      latencyMs: Date.now() - startTime,
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

export async function fetchMultipleResponses(
  prompt: string,
  modelIds: string[]
): Promise<ModelResult[]> {
  const promises = modelIds.map(async (modelId): Promise<ModelResult> => {
    try {
      const { text, latencyMs, usage } = await fetchOpenRouterResponse(prompt, modelId);
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
