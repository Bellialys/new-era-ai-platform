import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  checkRateLimitInMemory,
  checkRateLimit,
  getRateLimitKeyFromHeaders,
} from "./rate-limit";

describe("checkRateLimitInMemory", () => {
  it("allows requests up to the limit then blocks", () => {
    const key = `test-${Math.random()}`;
    const first = checkRateLimitInMemory(key, 2, 60_000);
    const second = checkRateLimitInMemory(key, 2, 60_000);
    const third = checkRateLimitInMemory(key, 2, 60_000);

    expect(first.limited).toBe(false);
    expect(first.remaining).toBe(1);
    expect(second.limited).toBe(false);
    expect(second.remaining).toBe(0);
    expect(third.limited).toBe(true);
  });

  it("resets after the window elapses", () => {
    const key = `test-${Math.random()}`;
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1_000);
    expect(checkRateLimitInMemory(key, 1, 5_000).limited).toBe(false);
    expect(checkRateLimitInMemory(key, 1, 5_000).limited).toBe(true);

    now.mockReturnValue(7_000); // past the 5s window
    expect(checkRateLimitInMemory(key, 1, 5_000).limited).toBe(false);

    now.mockRestore();
  });
});

describe("checkRateLimit (no Upstash configured)", () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
  });

  it("falls back to in-memory and returns a result", async () => {
    const result = await checkRateLimit(`test-${Math.random()}`, 5, 60_000);
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4);
  });
});

describe("getRateLimitKeyFromHeaders", () => {
  it("prefers the first x-forwarded-for ip", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" });
    expect(getRateLimitKeyFromHeaders(headers)).toBe("1.2.3.4");
  });

  it("falls back to x-real-ip then anonymous", () => {
    expect(getRateLimitKeyFromHeaders(new Headers({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(getRateLimitKeyFromHeaders(new Headers())).toBe("anonymous");
  });
});
