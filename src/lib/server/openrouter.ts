/**
 * OpenRouter API integration
 * - Handles API calls to OpenRouter
 * - Never exposes API key to client
 * - Implements timeout and error handling
 */

import { OPENROUTER_TIMEOUT_MS } from "@/lib/arena/constants";
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
      500,
      "API_KEY_MISSING",
      "OpenRouter API key is not configured. Please set OPENROUTER_API_KEY in environment variables."
    );
  }
  return apiKey;
}

/**
 * Fetch a single response from OpenRouter
 * @param prompt - User prompt
 * @param modelId - OpenRouter model ID
 * @returns The model's response text
 */
export async function fetchOpenRouterResponse(
  prompt: string,
  modelId: string
): Promise<string> {
  const apiKey = getApiKey();

  const request: OpenRouterRequest = {
    model: modelId,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "https://new-era-platform.vercel.app", // Required by OpenRouter
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    // Parse response regardless of status to get error details
    const data = (await response.json()) as
      | OpenRouterResponse
      | OpenRouterErrorResponse;

    if (!response.ok) {
      const errorData = data as OpenRouterErrorResponse;
      const errorMessage =
        errorData.error?.message || `OpenRouter API returned ${response.status}`;
      const errorCode = errorData.error?.code || "OPENROUTER_ERROR";

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

    // Extract answer from response
    const responseData = data as OpenRouterResponse;
    const content = responseData.choices?.[0]?.message?.content;
    if (!content) {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "OpenRouter returned empty response"
      );
    }

    return content;
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError(
        504,
        "TIMEOUT",
        `OpenRouter request timed out after ${OPENROUTER_TIMEOUT_MS}ms`
      );
    }

    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Network or other errors
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

/**
 * Fetch responses from multiple models in parallel
 * @param prompt - User prompt
 * @param modelIds - Array of OpenRouter model IDs
 * @returns Array of responses in the same order as modelIds
 */
export async function fetchMultipleResponses(
  prompt: string,
  modelIds: string[]
): Promise<(string | { error: string })[]> {
  const promises = modelIds.map(async (modelId) => {
    try {
      const response = await fetchOpenRouterResponse(prompt, modelId);
      return response;
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : "Failed to get response from this model";
      return { error: message };
    }
  });

  return Promise.all(promises);
}
