type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult =
  | { limited: false; remaining: number; resetAt: number }
  | { limited: true; remaining: 0; resetAt: number };

const buckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(
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

export function getRateLimitKeyFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "anonymous";
}
