import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  getUserMock,
  updateUserMock,
  checkRateLimitMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  updateUserMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: getUserMock,
      updateUser: updateUserMock,
    },
  })),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";
import {
  EMAIL_CHANGE_RATE_LIMIT_MAX_REQUESTS,
  EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CURRENT_EMAIL = "old@example.com";
const ORIGINAL_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ORIGINAL_SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ORIGINAL_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/profile/email", { method: "POST" });
  }

  return new NextRequest("http://localhost/api/profile/email", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function notLimited() {
  return {
    limited: false,
    remaining: EMAIL_CHANGE_RATE_LIMIT_MAX_REQUESTS - 1,
    resetAt: Date.now() + EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS,
  };
}

function rateLimited() {
  return {
    limited: true,
    remaining: 0,
    resetAt: Date.now() + EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS,
  };
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  process.env.NEXT_PUBLIC_SITE_URL = "http://localhost";

  getUserMock.mockReset();
  updateUserMock.mockReset();
  checkRateLimitMock.mockReset();

  getUserMock.mockResolvedValue({
    data: { user: { id: USER_ID, email: CURRENT_EMAIL } },
    error: null,
  });
  updateUserMock.mockResolvedValue({ error: null });
  checkRateLimitMock.mockResolvedValue(notLimited());
});

afterEach(() => {
  restoreEnv("NEXT_PUBLIC_SUPABASE_URL", ORIGINAL_SUPABASE_URL);
  restoreEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", ORIGINAL_SUPABASE_PUBLISHABLE_KEY);
  restoreEnv("NEXT_PUBLIC_SITE_URL", ORIGINAL_SITE_URL);
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/profile/email - auth guard", () => {
  it("returns 401 AUTH_REQUIRED without a Supabase session", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    const res = await POST(makeRequest({ newEmail: "new@example.com" }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/profile/email - rate limiting", () => {
  it("returns 429 RATE_LIMIT with Retry-After on the mocked fourth request", async () => {
    checkRateLimitMock
      .mockResolvedValueOnce(notLimited())
      .mockResolvedValueOnce(notLimited())
      .mockResolvedValueOnce(notLimited())
      .mockResolvedValueOnce(rateLimited());

    await POST(makeRequest({ newEmail: "new-1@example.com" }));
    await POST(makeRequest({ newEmail: "new-2@example.com" }));
    await POST(makeRequest({ newEmail: "new-3@example.com" }));
    updateUserMock.mockClear();

    const res = await POST(makeRequest({ newEmail: "new-4@example.com" }));
    const body = await res.json() as { errorCode?: string; message?: string };

    expect(res.status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(body.message).toBe("Too many email change requests. Please try again later.");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("scopes the limiter to the verified user id", async () => {
    await POST(makeRequest({ newEmail: "new@example.com" }));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `email-change:user:${USER_ID}`,
      EMAIL_CHANGE_RATE_LIMIT_MAX_REQUESTS,
      EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS
    );
  });

  it("checks the limiter before parsing the request body", async () => {
    checkRateLimitMock.mockResolvedValue(rateLimited());

    const res = await POST(makeRequest("this is not valid json {{{"));

    expect(res.status).toBe(429);
    expect(updateUserMock).not.toHaveBeenCalled();
  });
});
