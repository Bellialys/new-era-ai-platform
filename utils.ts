/**
 * Server utilities for API validation, safe errors and logging.
 *
 * Security rules:
 * - never log API keys;
 * - never log Authorization headers;
 * - never log full user prompts by default;
 * - return controlled ApiError messages to the client;
 * - hide unknown internal errors behind a generic response.
 */

import { ALLOWED_MODE_SLUGS, type ArenaModeSlug } from "@/lib/arena/constants";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface SafeErrorResponse {
  status: "error";
  errorCode: string;
  message: string;
}

export function createErrorResponse(error: unknown): SafeErrorResponse {
  if (error instanceof ApiError) {
    return {
      status: "error",
      errorCode: error.errorCode,
      message: error.message,
    };
  }

  console.error("Unexpected error:", error);

  return {
    status: "error",
    errorCode: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again.",
  };
}

export function validatePrompt(
  prompt: unknown,
  minLength: number,
  maxLength: number
): { valid: boolean; value?: string; error?: string } {
  if (typeof prompt !== "string") {
    return { valid: false, error: "Prompt is required" };
  }

  const trimmed = prompt.trim();

  if (trimmed.length < minLength) {
    return {
      valid: false,
      error: `Prompt must be at least ${minLength} characters`,
    };
  }

  if (trimmed.length > maxLength) {
    return {
      valid: false,
      error: `Prompt must be at most ${maxLength} characters`,
    };
  }

  return { valid: true, value: trimmed };
}

export function validateModelIds(
  modelIds: unknown,
  minSelect: number,
  maxSelect: number
): { valid: boolean; value?: string[]; error?: string } {
  if (!Array.isArray(modelIds)) {
    return { valid: false, error: "Model IDs must be an array" };
  }

  if (modelIds.length < minSelect) {
    return {
      valid: false,
      error: `Select at least ${minSelect} models`,
    };
  }

  if (modelIds.length > maxSelect) {
    return {
      valid: false,
      error: `Select at most ${maxSelect} models`,
    };
  }

  if (modelIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    return {
      valid: false,
      error: "All model IDs must be non-empty strings",
    };
  }

  const normalizedIds = modelIds.map((id) => id.trim());
  const uniqueIds = new Set(normalizedIds);

  if (uniqueIds.size !== normalizedIds.length) {
    return { valid: false, error: "Duplicate model IDs are not allowed" };
  }

  return { valid: true, value: normalizedIds };
}

export function validateModeSlug(
  modeSlug: unknown,
  fallbackModeSlug: ArenaModeSlug
): { valid: boolean; value?: ArenaModeSlug; error?: string } {
  if (modeSlug === undefined || modeSlug === null || modeSlug === "") {
    return { valid: true, value: fallbackModeSlug };
  }

  if (typeof modeSlug !== "string") {
    return { valid: false, error: "Mode slug must be a string" };
  }

  if (!ALLOWED_MODE_SLUGS.includes(modeSlug as ArenaModeSlug)) {
    return {
      valid: false,
      error: `Unsupported modeSlug. Allowed values: ${ALLOWED_MODE_SLUGS.join(", ")}`,
    };
  }

  return { valid: true, value: modeSlug as ArenaModeSlug };
}

export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs?: number
): void {
  const timestamp = new Date().toISOString();
  const duration = durationMs !== undefined ? ` (${durationMs}ms)` : "";
  console.log(`[${timestamp}] ${method} ${path} ${statusCode}${duration}`);
}

export function logOpenRouterCall(
  model: string,
  statusCode: number,
  durationMs: number
): void {
  const timestamp = new Date().toISOString();
  console.log(
    `[${timestamp}] OpenRouter call (${model}) ${statusCode} (${durationMs}ms)`
  );
}
