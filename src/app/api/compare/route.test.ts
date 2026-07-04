import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  resolveIdentityMock,
  checkRateLimitMock,
  resolveSelectedModelsMock,
  fetchMultipleResponsesMock,
  savePromptArenaRunMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  resolveSelectedModelsMock: vi.fn(),
  fetchMultipleResponsesMock: vi.fn(),
  savePromptArenaRunMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    resolveSelectedModels: resolveSelectedModelsMock,
    fetchMultipleResponses: fetchMultipleResponsesMock,
    savePromptArenaRun: savePromptArenaRunMock,
    applyGuestCookie: vi.fn(),
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";
import {
  COMPARE_RATE_LIMIT_MAX_REQUESTS,
  COMPARE_RATE_LIMIT_WINDOW_MS,
  PROMPT_MIN_LENGTH,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const VALID_MODEL_IDS = ["openai/gpt-4o", "anthropic/claude-3-5-sonnet"];
const VALID_PROMPT = "Which AI is better at poetry?";
const VALID_BODY = {
  prompt: VALID_PROMPT,
  modelIds: VALID_MODEL_IDS,
  modeSlug: "prompt-arena",
  stream: false,
};

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/compare", { method: "POST" });
  }
  return new NextRequest("http://localhost/api/compare", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const NOT_LIMITED = {
  limited: false,
  remaining: COMPARE_RATE_LIMIT_MAX_REQUESTS - 1,
  resetAt: Date.now() + COMPARE_RATE_LIMIT_WINDOW_MS,
};
const RATE_LIMITED = {
  limited: true,
  remaining: 0,
  resetAt: Date.now() + COMPARE_RATE_LIMIT_WINDOW_MS,
};

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  resolveSelectedModelsMock.mockReset();
  fetchMultipleResponsesMock.mockReset();
  savePromptArenaRunMock.mockReset();

  // Defaults: authenticated user, not rate-limited
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue(NOT_LIMITED);

  // Default model resolution and response for success path
  resolveSelectedModelsMock.mockResolvedValue([
    { selectionId: "m1", modelId: "db-m1", modelKey: VALID_MODEL_IDS[0], name: "GPT-4o", role: "assistant" },
    { selectionId: "m2", modelId: "db-m2", modelKey: VALID_MODEL_IDS[1], name: "Claude 3.5", role: "assistant" },
  ]);
  fetchMultipleResponsesMock.mockResolvedValue([
    { success: true, text: "Answer A", latencyMs: 100, usage: null },
    { success: true, text: "Answer B", latencyMs: 120, usage: null },
  ]);
  savePromptArenaRunMock.mockResolvedValue({
    taskId: "task-uuid",
    responseIdsByModelId: { m1: "r1", m2: "r2" },
  });
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/compare — auth guard", () => {
  it("returns 401 AUTH_REQUIRED when the caller has no identity", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });

  it("allows guest callers (guests have their own rate limit quota)", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/compare — rate limiting", () => {
  it("returns 429 RATE_LIMIT when the rate limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue(RATE_LIMITED);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(429);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("RATE_LIMIT");
  });

  it("includes Retry-After header when rate-limited", async () => {
    checkRateLimitMock.mockResolvedValue(RATE_LIMITED);

    const res = await POST(makeRequest(VALID_BODY));

    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it("keys rate limit to userId for authenticated users", async () => {
    await POST(makeRequest(VALID_BODY));

    const [key] = checkRateLimitMock.mock.calls[0] as [string, ...unknown[]];
    expect(key).toContain(USER_ID);
    expect(key).toContain("user:");
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("POST /api/compare — input validation", () => {
  it("returns 400 when prompt is shorter than the minimum length", async () => {
    const shortPrompt = "A".repeat(PROMPT_MIN_LENGTH - 1);
    const res = await POST(makeRequest({ ...VALID_BODY, prompt: shortPrompt }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when fewer than 2 model IDs are provided", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: [VALID_MODEL_IDS[0]] }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(resolveSelectedModelsMock).not.toHaveBeenCalled();
  });

  it("returns 400 when modelIds is empty", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: [] }));

    expect(res.status).toBe(400);
    expect((await res.json() as { errorCode?: string }).errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when the request body is not valid JSON", async () => {
    const res = await POST(makeRequest("not-json{{{"));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INVALID_JSON");
  });

  it("returns 400 for an invalid modeSlug", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modeSlug: "invalid-slug" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INVALID_MODE");
  });

  it("returns 400 when blind mode is requested on the non-blind compare route", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, blind: true }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string; message?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Blind mode is only supported via POST /api/stream-compare.");
    expect(resolveSelectedModelsMock).not.toHaveBeenCalled();
    expect(fetchMultipleResponsesMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Success path (non-streaming)
// ---------------------------------------------------------------------------

describe("POST /api/compare — success path (non-streaming)", () => {
  it("returns 200 with status and taskId on success", async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json() as { status?: string; taskId?: string; responses?: unknown[] };
    expect(body.status).toBe("success");
    expect(body.taskId).toBe("task-uuid");
    expect(Array.isArray(body.responses)).toBe(true);
  });
});
