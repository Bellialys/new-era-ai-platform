import { createHash } from "node:crypto";
import { getSupabaseServerClient } from "./supabase";
import type { RequestIdentity } from "./auth";
import { ApiError } from "./utils";

export const COMPARE_QUOTA_NAMESPACE = "prompt-arena-compare";

export type CompareQuotaOutcome = "accepted" | "replayed";

export interface CompareQuotaReservation {
  outcome: CompareQuotaOutcome;
  reservationId: string;
  retryAfterSeconds: number | null;
  responsePayload: unknown | null;
  responseStatus: number | null;
}

export class CompareQuotaExceededError extends ApiError {
  constructor(public readonly retryAfterSeconds: number) {
    super(429, "QUOTA_EXCEEDED", "Compare quota exceeded. Please try again later.");
    this.name = "CompareQuotaExceededError";
  }
}

export class CompareQuotaAuthorityError extends ApiError {
  constructor() {
    super(503, "QUOTA_AUTHORITY_UNAVAILABLE", "Compare quota is temporarily unavailable.");
    this.name = "CompareQuotaAuthorityError";
  }
}

export class CompareIdempotencyMismatchError extends ApiError {
  constructor() {
    super(409, "IDEMPOTENCY_KEY_REUSED", "Idempotency key was already used for a different request.");
    this.name = "CompareIdempotencyMismatchError";
  }
}

export class CompareInProgressError extends ApiError {
  constructor(public readonly retryAfterSeconds: number) {
    super(409, "COMPARE_IN_PROGRESS", "A request with this idempotency key is still processing. Retry later.");
    this.name = "CompareInProgressError";
  }
}

export class CompareResultExpiredError extends ApiError {
  constructor() {
    super(409, "IDEMPOTENCY_RESULT_UNAVAILABLE",
      "The prior result is no longer available. Submit a new comparison to start another request.");
    this.name = "CompareResultExpiredError";
  }
}

interface RpcReservationRow {
  reservation_id: string;
  outcome:
    | "accepted"
    | "replayed"
    | "quota_exceeded"
    | "idempotency_mismatch"
    | "in_progress"
    | "result_expired"
    | "authority_error";
  retry_after_seconds: number | null;
  response_payload: unknown | null;
  response_status: number | null;
}

function getSubject(identity: Exclude<RequestIdentity, { kind: "none" }>): {
  userId: string | null;
  guestId: string | null;
} {
  return identity.kind === "user"
    ? { userId: identity.userId, guestId: null }
    : { userId: null, guestId: identity.guestId };
}

function normalizeIdempotencyKey(key: string | null | undefined): string {
  const value = key?.trim();
  if (value && value.length <= 128) return value;
  return crypto.randomUUID();
}

function parseReservation(data: unknown): RpcReservationRow | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const candidate = row as Partial<RpcReservationRow>;
  if (
    typeof candidate.reservation_id !== "string" ||
    typeof candidate.outcome !== "string"
  ) {
    return null;
  }
  return candidate as RpcReservationRow;
}

/**
 * Atomically reserves one logical compare unit in the shared PostgreSQL quota.
 * The RPC is callable only with service-role credentials and resolves plan/role
 * from the trusted profile row; request bodies never provide quota authority.
 */
export async function reserveCompareQuota(input: {
  identity: Exclude<RequestIdentity, { kind: "none" }>;
  idempotencyKey?: string | null;
  fingerprint: string;
}): Promise<CompareQuotaReservation> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new CompareQuotaAuthorityError();

  const subject = getSubject(input.identity);
  const { data, error } = await supabase.rpc("reserve_compare_quota", {
    p_user_id: subject.userId,
    p_guest_id: subject.guestId,
    p_idempotency_key: normalizeIdempotencyKey(input.idempotencyKey),
    p_fingerprint: input.fingerprint,
  });

  if (error) {
    console.error("Compare quota RPC failed", { code: error.code });
    throw new CompareQuotaAuthorityError();
  }

  const result = parseReservation(data);
  if (!result) throw new CompareQuotaAuthorityError();

  if (result.outcome === "quota_exceeded") {
    throw new CompareQuotaExceededError(Math.max(result.retry_after_seconds ?? 1, 1));
  }
  if (result.outcome === "idempotency_mismatch") {
    throw new CompareIdempotencyMismatchError();
  }
  if (result.outcome === "in_progress") {
    throw new CompareInProgressError(Math.max(result.retry_after_seconds ?? 5, 1));
  }
  if (result.outcome === "result_expired") {
    throw new CompareResultExpiredError();
  }
  if (result.outcome !== "accepted" && result.outcome !== "replayed") {
    // Fail closed on unknown backend outcomes, rather than invoking a model
    // without evidence of a successful atomic quota reservation.
    throw new CompareQuotaAuthorityError();
  }
  if (!result.reservation_id) throw new CompareQuotaAuthorityError();

  return {
    outcome: result.outcome,
    reservationId: result.reservation_id,
    retryAfterSeconds: result.retry_after_seconds,
    responsePayload: result.response_payload,
    responseStatus: result.response_status,
  };
}

/**
 * Stores the safe compare response for a reservation so an idempotent retry can
 * return it without making another provider call.
 */
export async function completeCompareQuota(input: {
  reservationId: string;
  responsePayload: unknown;
  responseStatus: number;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new CompareQuotaAuthorityError();

  const params = {
    p_reservation_id: input.reservationId,
    p_response_payload: input.responsePayload,
    p_response_status: input.responseStatus,
  };

  // RPC POST isn't retried automatically. PostgreSQL now accepts an exact
  // duplicate completion as success, so a lost acknowledgement is safe to
  // retry without repeating paid inference. No retry for explicit DB vetoes.
  let lastCode: string | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { error } = await supabase.rpc("complete_compare_quota", params);
      if (!error) return;
      lastCode = error.code ?? "UNKNOWN";
      if (["P0001", "22023", "42501", "23514", "PGRST202"].includes(lastCode)) break;
    } catch {
      lastCode = "NETWORK_ERROR";
    }
    if (attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  console.error("Compare quota completion RPC failed", { code: lastCode });
  throw new CompareQuotaAuthorityError();
}

export function getCompareIdempotencyKey(request: {
  headers: { get(name: string): string | null };
}): string | null {
  const value = request.headers.get("Idempotency-Key")?.trim();
  return value && value.length <= 128 ? value : null;
}

export function createCompareFingerprint(input: {
  prompt: string;
  modelIds: string[];
  modeSlug: string;
  blind: boolean;
}): string {
  const canonicalRequest = JSON.stringify({
    modeSlug: input.modeSlug,
    prompt: input.prompt,
    modelIds: input.modelIds,
    blind: input.blind,
  });
  return createHash("sha256").update(canonicalRequest).digest("hex");
}

export function getCompareRetryAfterSeconds(error: unknown): number | null {
  return error instanceof CompareQuotaExceededError || error instanceof CompareInProgressError
    ? error.retryAfterSeconds
    : null;
}
