/**
 * Rate limiting for expensive API routes.
 *
 * Production (Vercel/serverless): set UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN to share a fixed-window counter across instances.
 *
 * Local/unconfigured: falls back to a per-instance in-memory counter. This is
 * fine for development but does NOT work across serverless instances, so always
 * configure Upstash before a public deploy.
 */

export type RateLimitResult =
  | { limited: false; remaining: number; resetAt: number }
  | { limited: true; remaining: 0; resetAt: number };

// --- In-memory fallback ---------------------------------------------------

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimitInMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  const existingBucket = buckets.get(key);

  if (!existingBucket || existingBucket.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { limited: false, remaining: Math.max(maxRequests - 1, 0), resetAt };
  }

  if (existingBucket.count >= maxRequests) {
    return { limited: true, remaining: 0, resetAt: existingBucket.resetAt };
  }

  existingBucket.count += 1;
  return {
    limited: false,
    remaining: Math.max(maxRequests - existingBucket.count, 0),
    resetAt: existingBucket.resetAt,
  };
}

// --- Upstash Redis (REST) -------------------------------------------------

type UpstashPipelineEntry = { result?: unknown; error?: string };

function getUpstashConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    return null;
  }
  return { url, token };
}

/**
 * Fixed-window counter via a single Upstash pipeline:
 *   1. SET key 0 NX PX windowMs  — initialise with TTL only on first hit
 *   2. INCR key                  — atomic increment, returns the new count
 *   3. PTTL key                  — remaining window in ms (for Retry-After)
 */
async function checkRateLimitUpstash(
  config: { url: string; token: string },
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", key, "0", "NX", "PX", windowMs.toString()],
      ["INCR", key],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Upstash pipeline failed with status ${response.status}`);
  }

  const entries = (await response.json()) as UpstashPipelineEntry[];
  const count = Number(entries?.[1]?.result);
  const pttlMs = Number(entries?.[2]?.result);

  if (!Number.isFinite(count)) {
    throw new Error("Upstash returned an unexpected INCR result");
  }

  const resetAt = Date.now() + (Number.isFinite(pttlMs) && pttlMs > 0 ? pttlMs : windowMs);

  if (count > maxRequests) {
    return { limited: true, remaining: 0, resetAt };
  }

  return { limited: false, remaining: Math.max(maxRequests - count, 0), resetAt };
}

// --- Public API -----------------------------------------------------------

/**
 * Check the rate limit for a key. Uses Upstash when configured, otherwise the
 * in-memory fallback. A transient Upstash failure fails open to the in-memory
 * limiter so a Redis outage never takes down the API.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const config = getUpstashConfig();
  if (!config) {
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }

  try {
    return await checkRateLimitUpstash(config, key, maxRequests, windowMs);
  } catch (error) {
    console.error("Upstash rate limit failed; falling back to in-memory:", error);
    return checkRateLimitInMemory(key, maxRequests, windowMs);
  }
}

export function getRateLimitKeyFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "anonymous";
}
