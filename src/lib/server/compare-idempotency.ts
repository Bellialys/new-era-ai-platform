import { createHash, randomUUID } from "node:crypto";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CompareIdempotencyKey =
  | { valid: true; key: string; suppliedByClient: boolean }
  | { valid: false; reason: string };

/**
 * Parse the optional Idempotency-Key request header without trusting it as
 * the caller identity. A missing key preserves the old client contract, but
 * cannot deduplicate a later retry unless the client reuses the generated key.
 */
export function parseCompareIdempotencyKey(value: string | null): CompareIdempotencyKey {
  if (value === null) {
    return { valid: true, key: randomUUID(), suppliedByClient: false };
  }

  // Keep the accepted syntax narrow and stable before storing a unique index.
  // In particular, do not silently trim or accept header injection characters.
  if (value.length !== 36 || !UUID_V4_RE.test(value)) {
    return { valid: false, reason: "Idempotency-Key must be a UUID v4." };
  }

  return { valid: true, key: value.toLowerCase(), suppliedByClient: true };
}

export interface CompareFingerprintInput {
  /** Distinguish SSE-only and dual-mode route semantics on key reuse. */
  route: "compare" | "stream-compare";
  /** Already validated and normalized by validatePrompt. */
  prompt: string;
  /** Validated client selection IDs in their original order. */
  modelIds: readonly string[];
  modeSlug: string;
  stream: boolean;
  blind: boolean;
}

/**
 * Deterministic request fingerprint for same-key/same-request comparison.
 * Deliberately excludes identity: the database scopes keys to the verified
 * owner independently. Never log or persist the unhashed prompt payload.
 */
export function fingerprintCompareRequest(input: CompareFingerprintInput): string {
  const bytes = JSON.stringify([
    "new-era-compare-v1",
    input.route,
    input.prompt,
    input.modelIds,
    input.modeSlug,
    input.stream,
    input.blind,
  ]);
  return createHash("sha256").update(bytes, "utf8").digest("hex");
}
