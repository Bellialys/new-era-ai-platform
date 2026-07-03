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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True for a syntactically valid v1–v5 UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

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

/** Error thrown when a backend dependency exceeds an explicit route timeout. */
export class TimeoutError extends Error {
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "TimeoutError";
  }
}

/**
 * Bound a backend dependency call so API routes can degrade instead of hanging.
 *
 * The wrapped operation may still finish in the background if its underlying
 * client does not support cancellation, but this promise resolves/rejects within
 * the requested timeout and prevents user-facing route timeouts.
 */
export async function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
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
  /** Correlates this error with server logs (see logApiRequest). */
  requestId?: string;
}

/**
 * Create a safe error response for the client
 * - Sanitizes the error message
 * - Does not include stack trace or internal details
 * - Optionally echoes a requestId so clients/logs can be correlated
 */
export function createErrorResponse(error: unknown, requestId?: string): SafeErrorResponse {
  if (error instanceof ApiError) {
    return {
      status: "error",
      errorCode: error.errorCode,
      message: error.message,
      ...(requestId ? { requestId } : {}),
    };
  }

  // Generic error - don't expose details
  console.error("Unexpected error:", error);

  return {
    status: "error",
    errorCode: "INTERNAL_ERROR",
    message: "An unexpected error occurred. Please try again.",
    ...(requestId ? { requestId } : {}),
  };
}

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Per-request correlation id. Honors an inbound x-request-id (e.g. from a proxy
 * or load balancer) when present, otherwise mints a fresh UUID.
 */
export function resolveRequestId(request: { headers: { get(name: string): string | null } }): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();
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
 * Return a shuffled copy using Fisher-Yates. The input array is never mutated,
 * so callers can safely preserve their original ordering for non-random flows.
 */
export function fisherYatesShuffle<T>(items: readonly T[]): T[] {
  const shuffled = [...items];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const current = shuffled[i];
    const replacement = shuffled[j];
    if (current === undefined || replacement === undefined) {
      continue;
    }
    shuffled[i] = replacement;
    shuffled[j] = current;
  }

  return shuffled;
}

export function blindSlotId(index: number): string {
  return `slot-${String.fromCharCode(97 + index)}`;
}

export function blindSlotName(index: number): string {
  return `Модель ${String.fromCharCode(65 + index)}`;
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
  durationMs?: number,
  requestId?: string
): void {
  const timestamp = new Date().toISOString();
  const duration = durationMs ? ` (${durationMs}ms)` : "";
  const rid = requestId ? ` rid=${requestId}` : "";
  const line = `[${timestamp}] ${method} ${path} ${statusCode}${duration}${rid}`;
  if (statusCode >= 500) {
    console.error(line);
    return;
  }
  console.warn(line);
}

export { REQUEST_ID_HEADER };
