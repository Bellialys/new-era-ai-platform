/**
 * OpenRouter API integration.
 *
 * The API key is used only on the server side and is never sent to the client.
 */

import {
  OPENROUTER_MAX_TOKENS,
  OPENROUTER_TIMEOUT_MS,
} from "@/lib/arena/constants";
import { ApiError, logOpenRouterCall } from "./utils";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterRequest {
  model: string;
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  temperature?: number;
  max_tokens?: number;
}

interface OpenRouterResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
}

interface OpenRouterErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
  };
}

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new ApiError(
      500,
      "API_KEY_MISSING",
      "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in environment variables."
    );
  }

  return apiKey;
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

function getOpenRouterErrorMessage(
  data: OpenRouterResponse | OpenRouterErrorResponse | null,
  status: number
): { errorCode: string; errorMessage: string } {
  const errorData = data as OpenRouterErrorResponse | null;
  const rawCode = errorData?.error?.code;
  const errorCode = rawCode ? String(rawCode) : "OPENROUTER_ERROR";
  const errorMessage =
    errorData?.error?.message ?? `OpenRouter API returned ${status}`;

  return { errorCode, errorMessage };
}

export type ModelResult =
  | { success: true; text: string; latencyMs: number }
  | { success: false; errorCode: string; errorMessage: string };

export async function fetchOpenRouterResponse(
  prompt: string,
  modelId: string
): Promise<{ text: string; latencyMs: number }> {
  const apiKey = getApiKey();
  const startTime = Date.now();

  const requestBody: OpenRouterRequest = {
    model: modelId,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: OPENROUTER_MAX_TOKENS,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    const data = await readOpenRouterJson(response);
    const latencyMs = Date.now() - startTime;
    logOpenRouterCall(modelId, response.status, latencyMs);

    if (!response.ok) {
      const { errorCode, errorMessage } = getOpenRouterErrorMessage(
        data,
        response.status
      );

      if (response.status === 401 || response.status === 403) {
        throw new ApiError(
          403,
          "AUTH_ERROR",
          `OpenRouter authentication failed: ${errorMessage}`
        );
      }

      if (response.status === 429) {
        throw new ApiError(
          429,
          "RATE_LIMIT",
          "OpenRouter rate limit exceeded. Please try again later."
        );
      }

      if (response.status >= 500) {
        throw new ApiError(
          502,
          errorCode,
          `OpenRouter service error: ${errorMessage}`
        );
      }

      throw new ApiError(response.status, errorCode, errorMessage);
    }

    if (!data) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "OpenRouter returned a non-JSON response"
      );
    }

    const responseData = data as OpenRouterResponse;
    const content = responseData.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "OpenRouter returned an empty response"
      );
    }

    return { text: content, latencyMs };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        504,
        "TIMEOUT",
        `OpenRouter request timed out after ${OPENROUTER_TIMEOUT_MS}ms`
      );
    }

    if (error instanceof ApiError) {
      throw error;
    }

    console.error("OpenRouter fetch error:", error);
    throw new ApiError(
      502,
      "NETWORK_ERROR",
      "Failed to connect to OpenRouter. Please try again."
    );
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
      const { text, latencyMs } = await fetchOpenRouterResponse(prompt, modelId);
      return { success: true, text, latencyMs };
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.errorCode : "UNKNOWN_ERROR";
      const errorMessage =
        error instanceof ApiError
          ? error.message
          : "Failed to get response from this model";

      return { success: false, errorCode, errorMessage };
    }
  });

  return Promise.all(promises);
}
