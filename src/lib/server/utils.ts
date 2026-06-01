/**
 * Server utilities for API error handling and logging
 * - Never log Authorization headers or sensitive data
 * - Log request metadata for debugging
 */

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
  prompt: string,
  minLength: number,
  maxLength: number
): { valid: boolean; error?: string } {
  if (!prompt || typeof prompt !== "string") {
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

  return { valid: true };
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
): { valid: boolean; error?: string } {
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
  if (modelIds.some((id) => !id || typeof id !== "string")) {
    return {
      valid: false,
      error: "All model IDs must be non-empty strings",
    };
  }

  // Check for duplicates
  const uniqueIds = new Set(modelIds);
  if (uniqueIds.size !== modelIds.length) {
    return { valid: false, error: "Duplicate model IDs are not allowed" };
  }

  return { valid: true };
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
