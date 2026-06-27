import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module is imported.
// ---------------------------------------------------------------------------

const { resolveIdentityMock, checkRateLimitMock, getRateLimitKeyMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getRateLimitKeyMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: vi.fn(),
    getRateLimitKeyFromHeaders: getRateLimitKeyMock,
  };
});

import { GET } from "./route";
import { IMAGE_MODELS } from "@/lib/arena/image-models";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeRequest(url = "http://localhost/api/image-models"): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  getRateLimitKeyMock.mockReset();

  // Happy-path defaults: IP-keyed, not rate-limited, authenticated user.
  getRateLimitKeyMock.mockReturnValue("1.2.3.4");
  checkRateLimitMock.mockResolvedValue({ limited: false, remaining: 9, resetAt: Date.now() + 60_000 });
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("GET /api/image-models — rate limiting", () => {
  it("returns 429 when the rate limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue({ limited: true, remaining: 0, resetAt: Date.now() + 60_000 });

    const res = await GET(makeRequest());
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(429);
    expect(body.error).toBe("RATE_LIMIT");
  });
});

// ---------------------------------------------------------------------------
// Identity-based model filtering
// ---------------------------------------------------------------------------

describe("GET /api/image-models — identity filtering", () => {
  it("returns all models for an authenticated user", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });

    const res = await GET(makeRequest());
    const body = await res.json() as { models?: typeof IMAGE_MODELS };

    expect(res.status).toBe(200);
    expect(body.models?.length).toBe(IMAGE_MODELS.length);
  });

  it("returns only anonymous-accessible models for a guest", async () => {
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const res = await GET(makeRequest());
    const body = await res.json() as { models?: Array<{ accessLevel: string; id: string }> };

    expect(res.status).toBe(200);
    const anonymous = IMAGE_MODELS.filter((m) => m.accessLevel === "anonymous");
    expect(body.models?.length).toBe(anonymous.length);
    body.models?.forEach((m) => {
      expect(m.accessLevel).toBe("anonymous");
    });
  });

  it("returns only anonymous-accessible models when the caller has no identity", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await GET(makeRequest());
    const body = await res.json() as { models?: Array<{ accessLevel: string }> };

    expect(res.status).toBe(200);
    body.models?.forEach((m) => {
      expect(m.accessLevel).toBe("anonymous");
    });
  });

  it("guest cannot access registered-only models even by passing model IDs in the URL", async () => {
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "guest-id",
    });

    // Extra query params must not bypass the identity filter.
    const res = await GET(makeRequest("http://localhost/api/image-models?all=true"));
    const body = await res.json() as { models?: Array<{ id: string; accessLevel: string }> };

    expect(res.status).toBe(200);
    const registeredIds = IMAGE_MODELS
      .filter((m) => m.accessLevel !== "anonymous")
      .map((m) => m.id);

    body.models?.forEach((m) => {
      expect(registeredIds).not.toContain(m.id);
    });
  });
});

// ---------------------------------------------------------------------------
// Response contract
// ---------------------------------------------------------------------------

describe("GET /api/image-models — response shape", () => {
  it("returns status 'success' with a models array", async () => {
    const res = await GET(makeRequest());
    const body = await res.json() as { status?: string; models?: unknown[] };

    expect(res.status).toBe(200);
    expect(body.status).toBe("success");
    expect(Array.isArray(body.models)).toBe(true);
  });

  it("each model has id, name, badge, and accessLevel fields", async () => {
    const res = await GET(makeRequest());
    const body = await res.json() as {
      models?: Array<{ id?: string; name?: string; badge?: unknown[]; accessLevel?: string }>;
    };

    body.models?.forEach((m) => {
      expect(typeof m.id).toBe("string");
      expect(typeof m.name).toBe("string");
      expect(Array.isArray(m.badge)).toBe(true);
      expect(typeof m.accessLevel).toBe("string");
    });
  });
});
