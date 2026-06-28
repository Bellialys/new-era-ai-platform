import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  checkRateLimitMock,
  readGuestSessionIdMock,
  supabaseMock,
} = vi.hoisted(() => {
  const singleMock = vi.fn();
  const insertMock = vi.fn();

  const mock = {
    from: vi.fn(),
    select: vi.fn(),
    insert: insertMock,
    update: vi.fn(),
    eq: vi.fn(),
    single: singleMock,
    // The guest route calls .then() directly on the query builder for fire-and-forget
    // updates. This must be a function so the call doesn't throw, but it must not resolve
    // so that the caller never awaits supabaseMock itself as a thenable.
    then: vi.fn(),
  };

  // All builder methods return the mock itself so chains work.
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.insert.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);

  return {
    checkRateLimitMock: vi.fn(),
    readGuestSessionIdMock: vi.fn(),
    supabaseMock: mock,
  };
});

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    readGuestSessionId: readGuestSessionIdMock,
    applyGuestCookie: vi.fn(),  // no-op — cookie header tests aren't needed here
    getSupabaseServerClient: vi.fn().mockReturnValue(supabaseMock),
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FAKE_IP = "1.2.3.4";
const FAKE_SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NEW_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeRequest(ip = FAKE_IP): NextRequest {
  return new NextRequest("http://localhost/api/guest", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

const NOT_LIMITED = { limited: false, remaining: 9, resetAt: Date.now() + 60_000 };
const LIMITED = { limited: true, remaining: 0, resetAt: Date.now() + 55_000 };

beforeEach(() => {
  checkRateLimitMock.mockReset();
  readGuestSessionIdMock.mockReset();
  supabaseMock.from.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.select.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.insert.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.update.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.eq.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.single.mockReset();

  // Defaults: not rate-limited, no existing guest session.
  checkRateLimitMock.mockResolvedValue(NOT_LIMITED);
  readGuestSessionIdMock.mockReturnValue(null);

  // Default: successful insert returning a new session ID.
  supabaseMock.single.mockResolvedValue({ data: { id: NEW_SESSION_ID }, error: null });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/guest — rate limiting", () => {
  it("returns 201 and creates a session when under the rate limit", async () => {
    checkRateLimitMock.mockResolvedValue(NOT_LIMITED);

    const res = await POST(makeRequest());

    expect(res.status).toBe(201);
    const body = await res.json() as { status?: string; isNew?: boolean };
    expect(body.status).toBe("success");
    expect(body.isNew).toBe(true);
  });

  it("returns 429 RATE_LIMIT when the limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue(LIMITED);

    const res = await POST(makeRequest());

    expect(res.status).toBe(429);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("RATE_LIMIT");
  });

  it("includes Retry-After header when rate-limited", async () => {
    checkRateLimitMock.mockResolvedValue(LIMITED);

    const res = await POST(makeRequest());

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("does NOT insert into anonymous_sessions when rate-limited", async () => {
    checkRateLimitMock.mockResolvedValue(LIMITED);

    await POST(makeRequest());

    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });

  it("keys the rate limit on the IP address from x-forwarded-for", async () => {
    checkRateLimitMock.mockResolvedValue(NOT_LIMITED);

    await POST(makeRequest("9.8.7.6"));

    const [key] = checkRateLimitMock.mock.calls[0] as [string, ...unknown[]];
    expect(key).toContain("9.8.7.6");
  });

  it("uses 'unknown' as the IP key when x-forwarded-for is absent", async () => {
    checkRateLimitMock.mockResolvedValue(NOT_LIMITED);
    const req = new NextRequest("http://localhost/api/guest", { method: "POST" });

    await POST(req);

    const [key] = checkRateLimitMock.mock.calls[0] as [string, ...unknown[]];
    expect(key).toContain("unknown");
  });
});

// ---------------------------------------------------------------------------
// Session creation (new session)
// ---------------------------------------------------------------------------

describe("POST /api/guest — new session creation", () => {
  it("inserts into anonymous_sessions when no existing session is found", async () => {
    readGuestSessionIdMock.mockReturnValue(null);

    await POST(makeRequest());

    expect(supabaseMock.insert).toHaveBeenCalledTimes(1);
    expect(supabaseMock.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        display_name: expect.any(String),
        avatar_seed: expect.any(String),
        color_seed: expect.any(String),
      })
    );
  });

  it("returns the new session ID from the DB insert", async () => {
    supabaseMock.single.mockResolvedValue({ data: { id: NEW_SESSION_ID }, error: null });

    const res = await POST(makeRequest());
    const body = await res.json() as { sessionId?: string };

    expect(body.sessionId).toBe(NEW_SESSION_ID);
  });

  it("returns 500 INTERNAL_ERROR when the insert fails", async () => {
    supabaseMock.single.mockResolvedValue({ data: null, error: { message: "DB error" } });

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });
});

// ---------------------------------------------------------------------------
// Existing session reuse
// ---------------------------------------------------------------------------

describe("POST /api/guest — existing session reuse", () => {
  it("returns 200 (not 201) when an existing session is found and valid", async () => {
    readGuestSessionIdMock.mockReturnValue(FAKE_SESSION_ID);
    // First single() call is the lookup for existing session
    supabaseMock.single.mockResolvedValue({
      data: {
        id: FAKE_SESSION_ID,
        display_name: "Анонимус #1234",
        avatar_seed: "abc",
        color_seed: "def",
      },
      error: null,
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json() as { isNew?: boolean; sessionId?: string };
    expect(body.isNew).toBe(false);
    expect(body.sessionId).toBe(FAKE_SESSION_ID);
  });

  it("does NOT call insert when an existing session is reused", async () => {
    readGuestSessionIdMock.mockReturnValue(FAKE_SESSION_ID);
    supabaseMock.single.mockResolvedValue({
      data: { id: FAKE_SESSION_ID, display_name: "X", avatar_seed: "a", color_seed: "b" },
      error: null,
    });

    await POST(makeRequest());

    expect(supabaseMock.insert).not.toHaveBeenCalled();
  });
});
