import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  resolveIdentityMock,
  checkRateLimitMock,
  fetchOpenRouterMock,
  supabaseMock,
} = vi.hoisted(() => {
  // All Supabase builder methods return `this` so the fluent chain works.
  // `.single()` is the only terminal that needs a real resolved value.
  const singleMock = vi.fn();
  const updateMock = vi.fn();

  const mock = {
    from: vi.fn(),
    select: vi.fn(),
    update: updateMock,
    eq: vi.fn(),
    single: singleMock,
  };

  // Wire every builder method to return the mock itself so chains are valid.
  mock.from.mockReturnValue(mock);
  mock.select.mockReturnValue(mock);
  mock.update.mockReturnValue(mock);
  mock.eq.mockReturnValue(mock);

  return {
    resolveIdentityMock: vi.fn(),
    checkRateLimitMock: vi.fn(),
    fetchOpenRouterMock: vi.fn(),
    supabaseMock: mock,
  };
});

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    fetchOpenRouterResponse: fetchOpenRouterMock,
    getSupabaseServerClient: vi.fn().mockReturnValue(supabaseMock),
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";
import {
  JUDGE_RATE_LIMIT_MAX_REQUESTS,
  JUDGE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const GUEST_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const VALID_RESPONSES = [
  { modelId: "m1", modelName: "Model A", answerText: "Answer from Model A" },
  { modelId: "m2", modelName: "Model B", answerText: "Answer from Model B" },
];

const VALID_BODY = { prompt: "Which answer is better?", responses: VALID_RESPONSES };
const VALID_BODY_WITH_TASK = { ...VALID_BODY, taskId: TASK_ID };

const JUDGE_JSON = JSON.stringify({
  winner: "A",
  reasoning: "Model A was more concise.",
  scores: { A: 9, B: 7 },
});

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/judge", { method: "POST" });
  }
  return new NextRequest("http://localhost/api/judge", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  fetchOpenRouterMock.mockReset();

  // Reset builder mocks — restore chain behavior after each test.
  supabaseMock.from.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.select.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.update.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.eq.mockReset().mockReturnValue(supabaseMock);
  supabaseMock.single.mockReset();

  // Defaults: authenticated user, not rate-limited, judge returns valid JSON.
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue({
    limited: false,
    remaining: JUDGE_RATE_LIMIT_MAX_REQUESTS - 1,
    resetAt: Date.now() + JUDGE_RATE_LIMIT_WINDOW_MS,
  });
  fetchOpenRouterMock.mockResolvedValue({ text: JUDGE_JSON, latencyMs: 200 });

  // Default ownership check: task exists and belongs to current user.
  // `.single()` is the only terminal; the chain up to it uses mockReturnValue(supabaseMock).
  supabaseMock.single.mockResolvedValue({ data: { id: TASK_ID }, error: null });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

describe("POST /api/judge — authentication", () => {
  it("returns 401 when the caller has no identity", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(fetchOpenRouterMock).not.toHaveBeenCalled();
  });

  it("allows guest callers — judge mode supports guest sessions", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    // No taskId supplied → no ownership check needed
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// IDOR write protection — owner check on judge_verdict update
// ---------------------------------------------------------------------------

describe("POST /api/judge — IDOR write protection", () => {
  it("returns 404 and skips the update when the taskId does not belong to the caller", async () => {
    // Ownership query returns no row → task not owned by caller
    supabaseMock.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const res = await POST(makeRequest(VALID_BODY_WITH_TASK));

    expect(res.status).toBe(404);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("NOT_FOUND");
    // update() must not have been called — no write to the foreign task
    expect(supabaseMock.update).not.toHaveBeenCalled();
  });

  it("performs the update only after confirming ownership", async () => {
    // Ownership check succeeds: task belongs to USER_ID
    supabaseMock.single.mockResolvedValue({ data: { id: TASK_ID }, error: null });

    const res = await POST(makeRequest(VALID_BODY_WITH_TASK));

    expect(res.status).toBe(200);
    // update() was called exactly once with the verdict
    expect(supabaseMock.update).toHaveBeenCalledTimes(1);
    expect(supabaseMock.update).toHaveBeenCalledWith(
      expect.objectContaining({ judge_verdict: expect.any(Object) })
    );
  });

  it("skips both the ownership check and update when no taskId is supplied", async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    // No DB interaction needed when taskId is absent
    expect(supabaseMock.update).not.toHaveBeenCalled();
    expect(supabaseMock.single).not.toHaveBeenCalled();
  });

  it("uses anonymous_session_id for ownership check when caller is a guest", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });
    supabaseMock.single.mockResolvedValue({ data: { id: TASK_ID }, error: null });

    await POST(makeRequest(VALID_BODY_WITH_TASK));

    const eqCalls = supabaseMock.eq.mock.calls as [string, string][];
    const ownerFilter = eqCalls.find(([col]) => col === "anonymous_session_id");
    expect(ownerFilter).toBeDefined();
    expect(ownerFilter?.[1]).toBe(GUEST_ID);
  });

  it("returns 200 with verdict when owner check passes", async () => {
    const res = await POST(makeRequest(VALID_BODY_WITH_TASK));
    const body = await res.json() as { status?: string; verdict?: { winnerModelId?: string } };

    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.verdict?.winnerModelId).toBe("m1");
  });
});

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

describe("POST /api/judge — request validation", () => {
  it("returns 400 INVALID_BODY when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("not json {{{"));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INVALID_BODY");
  });

  it("returns 400 when prompt is too short (less than 3 characters)", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, prompt: "AB" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INVALID_PROMPT");
  });

  it("returns 400 when fewer than 2 responses are provided", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, responses: [VALID_RESPONSES[0]] }));

    expect(res.status).toBe(400);
  });
});
