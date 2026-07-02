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
  const savedKvUrl = process.env.KV_REST_API_URL;
  const savedKvToken = process.env.KV_REST_API_TOKEN;

  beforeEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
  });

  afterEach(() => {
    if (savedUrl !== undefined) process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    if (savedToken !== undefined) process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    if (savedKvUrl !== undefined) process.env.KV_REST_API_URL = savedKvUrl;
    if (savedKvToken !== undefined) process.env.KV_REST_API_TOKEN = savedKvToken;
  });

  it("falls back to in-memory and returns a result", async () => {
    const result = await checkRateLimit(`test-${Math.random()}`, 5, 60_000);
    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4);
  });

  it("does not call fetch when Upstash is not configured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit(`no-redis-${Math.random()}`, 5, 60_000);

    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// ---------------------------------------------------------------------------
// Upstash Redis path — all tests use a mocked global fetch; no real network.
// ---------------------------------------------------------------------------

describe("checkRateLimit (Upstash configured)", () => {
  const savedUrl = process.env.UPSTASH_REDIS_REST_URL;
  const savedToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const savedKvUrl = process.env.KV_REST_API_URL;
  const savedKvToken = process.env.KV_REST_API_TOKEN;

  beforeEach(() => {
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });

  afterEach(() => {
    if (savedUrl !== undefined) {
      process.env.UPSTASH_REDIS_REST_URL = savedUrl;
    } else {
      delete process.env.UPSTASH_REDIS_REST_URL;
    }
    if (savedToken !== undefined) {
      process.env.UPSTASH_REDIS_REST_TOKEN = savedToken;
    } else {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    }
    if (savedKvUrl !== undefined) {
      process.env.KV_REST_API_URL = savedKvUrl;
    } else {
      delete process.env.KV_REST_API_URL;
    }
    if (savedKvToken !== undefined) {
      process.env.KV_REST_API_TOKEN = savedKvToken;
    } else {
      delete process.env.KV_REST_API_TOKEN;
    }
    vi.unstubAllGlobals();
  });

  function mockUpstashFetch(count: number, pttlMs = 59_000) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { result: "OK" },    // SET NX
        { result: count },   // INCR → current count
        { result: pttlMs },  // PTTL → remaining window
      ],
    });
  }

  it("calls the Upstash /pipeline endpoint with correct auth header", async () => {
    const fetchMock = mockUpstashFetch(1);
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit("test-upstash-auth", 5, 60_000);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://fake.upstash.io/pipeline");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer fake-token");
  });

  it("supports Vercel Marketplace KV_REST_API_URL/TOKEN aliases", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    process.env.KV_REST_API_URL = "https://fake-marketplace.upstash.io";
    process.env.KV_REST_API_TOKEN = "fake-marketplace-token";
    const fetchMock = mockUpstashFetch(1);
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit("test-upstash-marketplace-alias", 5, 60_000);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe("https://fake-marketplace.upstash.io/pipeline");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer fake-marketplace-token");
  });

  it("returns limited:false with correct remaining count on first hit", async () => {
    vi.stubGlobal("fetch", mockUpstashFetch(1));

    const result = await checkRateLimit("test-upstash-first-hit", 5, 60_000);

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(4); // maxRequests(5) - count(1)
  });

  it("returns limited:true when INCR count exceeds maxRequests", async () => {
    vi.stubGlobal("fetch", mockUpstashFetch(6)); // count 6 > max 5

    const result = await checkRateLimit("test-upstash-exceeded", 5, 60_000);

    expect(result.limited).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns remaining:0 (not negative) when count equals maxRequests exactly", async () => {
    vi.stubGlobal("fetch", mockUpstashFetch(5)); // count == max

    const result = await checkRateLimit("test-upstash-at-limit", 5, 60_000);

    expect(result.limited).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("sends SET-NX + INCR + PTTL pipeline commands with the correct key", async () => {
    const fetchMock = mockUpstashFetch(1);
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit("pipeline-order-key", 3, 30_000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as string[][];
    expect(body[0][0]).toBe("SET");
    expect(body[0][1]).toBe("pipeline-order-key");
    expect(body[0]).toContain("NX");
    expect(body[0]).toContain("PX");
    expect(body[1]).toEqual(["INCR", "pipeline-order-key"]);
    expect(body[2]).toEqual(["PTTL", "pipeline-order-key"]);
  });

  it("passes the window duration as a PX value in the SET command", async () => {
    const fetchMock = mockUpstashFetch(1);
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit("window-ms-key", 3, 45_000);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as string[][];
    const pxIndex = body[0].indexOf("PX");
    expect(body[0][pxIndex + 1]).toBe("45000");
  });

  it("falls back to in-memory when Upstash returns a non-OK HTTP status (fail-open)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const result = await checkRateLimit(`fallback-non-ok-${Math.random()}`, 5, 60_000);

    expect(result.limited).toBe(false); // fail-open: never block on Redis outage
  });

  it("falls back to in-memory when the Upstash fetch rejects with a network error (fail-open)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const result = await checkRateLimit(`fallback-net-err-${Math.random()}`, 5, 60_000);

    expect(result.limited).toBe(false);
  });

  it("does not include the Redis token in the request body", async () => {
    const fetchMock = mockUpstashFetch(1);
    vi.stubGlobal("fetch", fetchMock);

    await checkRateLimit("secret-check-key", 5, 60_000);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    // Token must travel only in the Authorization header, never in the body
    expect(init.body as string).not.toContain("fake-token");
  });

  it("computes resetAt from PTTL when it is a positive finite number", async () => {
    const pttlMs = 45_000;
    vi.stubGlobal("fetch", mockUpstashFetch(1, pttlMs));
    const before = Date.now();

    const result = await checkRateLimit("reset-at-key", 5, 60_000);

    const after = Date.now();
    expect(result.resetAt).toBeGreaterThanOrEqual(before + pttlMs);
    expect(result.resetAt).toBeLessThanOrEqual(after + pttlMs);
  });
});

// ---------------------------------------------------------------------------
// Security invariants — cross-key isolation and key-injection resistance.
// ---------------------------------------------------------------------------

describe("checkRateLimit — security invariants", () => {
  it("separate keys produce independent buckets: exhausting one key does not affect another", () => {
    const userAKey = `team-run:user:user-a-${Math.random()}`;
    const userBKey = `team-run:user:user-b-${Math.random()}`;

    // Exhaust user-a's bucket
    checkRateLimitInMemory(userAKey, 1, 60_000);
    const blocked = checkRateLimitInMemory(userAKey, 1, 60_000);
    expect(blocked.limited).toBe(true);

    // user-b is a different key → unaffected
    const result = checkRateLimitInMemory(userBKey, 1, 60_000);
    expect(result.limited).toBe(false);
  });

  it("key prefixes are distinct: team-run and compare keys never collide", () => {
    const sharedSuffix = `shared-suffix-${Math.random()}`;
    const teamKey = `team-run:user:${sharedSuffix}`;
    const compareKey = `compare:user:${sharedSuffix}`;

    checkRateLimitInMemory(teamKey, 1, 60_000);
    checkRateLimitInMemory(teamKey, 1, 60_000); // limited

    const result = checkRateLimitInMemory(compareKey, 1, 60_000);
    expect(result.limited).toBe(false);
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
