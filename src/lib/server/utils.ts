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

/**
 * Safe error response for API
 * - Does not expose internal stack traces
 * - Safe for sending to client
 */
export interface SafeErrorResponse {
  status: "error";
  errorCode: string;
  message: string;
}

/**
 * Create a safe error response for the client
 * - Sanitizes the error message
 * - Does not include stack trace or internal details
 */
export function createErrorResponse(error: unknown): SafeErrorResponse {
  if (error instanceof ApiError) {
    return {
      status: "error",
      errorCode: error.errorCode,
      message: error.message,
    };
  }

  // Generic error - don't expose details
  console.error("Unexpected error:", error);

  return {
    status: "error",
    errorCode: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again.",
  };
}

/**
 * Validate prompt text
 * - Check length constraints
 * - Check for empty/whitespace-only strings
 */
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

/**
 * Validate model IDs array
 * - Check count constraints
 * - Check for duplicates
 * - Check for empty strings
 */
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

  // Check for empty strings
  if (modelIds.some((id) => typeof id !== "string" || id.trim().length === 0)) {
    return {
      valid: false,
      error: "All model IDs must be non-empty strings",
    };
  }

  // Check for duplicates
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

/**
 * Log API request metadata (safe logging)
 * - DO NOT log request body or headers with secrets
 * - DO NOT log Authorization headers
 * - Log method, path, timestamps, status codes
 */
export function logApiRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs?: number
): void {
  const timestamp = new Date().toISOString();
  const duration = durationMs ? ` (${durationMs}ms)` : "";
  console.log(`[${timestamp}] ${method} ${path} ${statusCode}${duration}`);
}

/**
 * Log OpenRouter API call details (safe logging)
 * - DO NOT log API key
 * - DO NOT log full request/response bodies with sensitive data
 * - Log status, models used, timestamp
 */
export function logOpenRouterCall(
  models: string[],
  statusCode: number,
  durationMs: number
): void {
  const timestamp = new Date().toISOString();
  const modelList = models.join(", ");
  console.log(
    `[${timestamp}] OpenRouter call (${modelList}) → ${statusCode} (${durationMs}ms)`
  );
}
