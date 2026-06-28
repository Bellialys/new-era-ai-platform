import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  resolveIdentityMock,
  checkRateLimitMock,
  listHistoryMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  listHistoryMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    listHistory: listHistoryMock,
    applyGuestCookie: vi.fn(),
    logApiRequest: vi.fn(),
    resolveRequestId: vi.fn().mockReturnValue("test-request-id"),
  };
});

import { GET } from "./route";
import {
  HISTORY_RATE_LIMIT_MAX_REQUESTS,
  HISTORY_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const MOCK_HISTORY_ITEMS = [
  {
    taskId: "task-1",
    modeSlug: "prompt-arena",
    promptText: "Hello",
    title: null,
    status: "completed",
    createdAt: "2026-06-28T00:00:00Z",
    modelCount: 2,
  },
];

function makeRequest(params?: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/history");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url.toString(), { method: "GET" });
}

const NOT_LIMITED = {
  limited: false,
  remaining: HISTORY_RATE_LIMIT_MAX_REQUESTS - 1,
  resetAt: Date.now() + HISTORY_RATE_LIMIT_WINDOW_MS,
};
const RATE_LIMITED = {
  limited: true,
  remaining: 0,
  resetAt: Date.now() + HISTORY_RATE_LIMIT_WINDOW_MS,
};

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  listHistoryMock.mockReset();

  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue(NOT_LIMITED);
  listHistoryMock.mockResolvedValue({ items: MOCK_HISTORY_ITEMS, nextCursor: null });
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("GET /api/history — auth guard", () => {
  it("returns 401 AUTH_REQUIRED when the caller has no identity", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(listHistoryMock).not.toHaveBeenCalled();
  });

  it("allows guest callers to view their history", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ identity: { userId: null, anonymousSessionId: GUEST_ID } })
    );
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("GET /api/history — rate limiting", () => {
  it("returns 429 RATE_LIMIT when the limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue(RATE_LIMITED);

    const res = await GET(makeRequest());

    expect(res.status).toBe(429);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(listHistoryMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Success path and pagination
// ---------------------------------------------------------------------------

describe("GET /api/history — success", () => {
  it("returns 200 with items and nextCursor", async () => {
    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json() as {
      status?: string;
      items?: unknown[];
      nextCursor?: null | string;
    };
    expect(body.status).toBe("success");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.nextCursor).toBeNull();
  });

  it("passes pagination params (limit and cursor) to listHistory", async () => {
    listHistoryMock.mockResolvedValue({
      items: MOCK_HISTORY_ITEMS,
      nextCursor: "cursor-token",
    });

    await GET(makeRequest({ limit: "5", cursor: "prev-cursor" }));

    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, cursor: "prev-cursor" })
    );
  });

  it("passes mode filter param to listHistory when provided", async () => {
    await GET(makeRequest({ mode: "prompt-arena" }));

    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ modeSlug: "prompt-arena" })
    );
  });

  it("ignores a non-numeric limit param gracefully", async () => {
    // Invalid limit → parseLimit returns undefined → listHistory uses its default
    await GET(makeRequest({ limit: "not-a-number" }));

    expect(listHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: undefined })
    );
  });
});
