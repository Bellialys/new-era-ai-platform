import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const { resolveIdentityMock, supabaseMock } = vi.hoisted(() => {
  const supabaseMock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };
  return { resolveIdentityMock: vi.fn(), supabaseMock };
});

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    getSupabaseServerClient: vi.fn().mockReturnValue(supabaseMock),
    createErrorResponse: actual.createErrorResponse,
    logApiRequest: vi.fn(),
    ApiError: actual.ApiError,
  };
});

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_USER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TASK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GUEST_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const VALID_TASK_ROW = {
  id: TASK_ID,
  mode_slug: "prompt-arena",
  task_text: "Hello world",
  title: null,
  status: "completed",
  created_at: "2026-06-28T00:00:00Z",
  settings: {},
  judge_verdict: null,
  is_blind: false,
  model_responses: [],
  votes: [],
};

function makeRequest(taskId: string): NextRequest {
  return new NextRequest(`http://localhost/api/tasks/${taskId}`, { method: "GET" });
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  supabaseMock.from.mockReset().mockReturnThis();
  supabaseMock.select.mockReset().mockReturnThis();
  supabaseMock.eq.mockReset().mockReturnThis();
  supabaseMock.single.mockReset();
  supabaseMock.maybeSingle.mockReset();

  // Default: authenticated user
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  // Default: task found and owned
  supabaseMock.single.mockResolvedValue({ data: VALID_TASK_ROW, error: null });
  supabaseMock.maybeSingle.mockResolvedValue({ data: null, error: null });
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("GET /api/tasks/[taskId] — auth guard", () => {
  it("returns 401 when the caller has no identity (unauthenticated)", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(401);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code ?? (body as Record<string, unknown>).errorCode).toBe("AUTH_REQUIRED");
  });

  it("returns 401 when the caller is a guest (task access requires a user account)", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(401);
  });

  it("proceeds for an authenticated user", async () => {
    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json() as { task?: { id?: string } };
    expect(body.task?.id).toBe(TASK_ID);
  });
});

// ---------------------------------------------------------------------------
// UUID validation
// ---------------------------------------------------------------------------

describe("GET /api/tasks/[taskId] — input validation", () => {
  it("returns 400 for a malformed taskId", async () => {
    const res = await GET(
      makeRequest("not-a-uuid"),
      { params: Promise.resolve({ taskId: "not-a-uuid" }) }
    );

    expect(res.status).toBe(400);
    const body = await res.json() as { error?: { code?: string } };
    expect(body.error?.code).toBe("INVALID_ID");
    // Auth check must not run before UUID validation
    expect(resolveIdentityMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty taskId", async () => {
    const res = await GET(makeRequest(""), { params: Promise.resolve({ taskId: "" }) });

    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Owner scope
// ---------------------------------------------------------------------------

describe("GET /api/tasks/[taskId] — owner scope", () => {
  it("returns 404 when the task exists but belongs to a different user", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "user", userId: OTHER_USER_ID, guestId: null });
    // Supabase returns no row (owner filter excluded it)
    supabaseMock.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(404);
  });

  it("returns 404 when the task does not exist at all", async () => {
    supabaseMock.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(404);
  });

  it("includes user_id in the Supabase query to enforce owner scope", async () => {
    await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    // The .eq() chain must have been called with user_id to scope the query to the owner.
    const eqCalls = supabaseMock.eq.mock.calls as [string, string][];
    const ownerFilter = eqCalls.find(([col]) => col === "user_id");
    expect(ownerFilter).toBeDefined();
    expect(ownerFilter?.[1]).toBe(USER_ID);
  });

  it("returns full task data for the task owner", async () => {
    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });

    expect(res.status).toBe(200);
    const body = await res.json() as { task?: Record<string, unknown> };
    expect(body.task).toBeDefined();
    expect(body.task?.id).toBe(TASK_ID);
    expect(body.task?.modeSlug).toBe("prompt-arena");
  });

  it("masks model identity for blind tasks until the owner has a best vote", async () => {
    supabaseMock.single.mockResolvedValue({
      data: {
        ...VALID_TASK_ROW,
        is_blind: true,
        model_responses: [
          {
            id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            model_key: "provider/real-a",
            display_name: "Real Model A",
            status: "success",
            response_text: "answer a",
            latency_ms: 100,
            error_code: null,
            error_message: null,
            created_at: "2026-06-28T00:00:01Z",
          },
          {
            id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
            model_key: "provider/real-b",
            display_name: "Real Model B",
            status: "success",
            response_text: "answer b",
            latency_ms: 120,
            error_code: null,
            error_message: null,
            created_at: "2026-06-28T00:00:02Z",
          },
        ],
        votes: [],
      },
      error: null,
    });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });
    const body = await res.json() as {
      task?: { isBlind?: boolean; responses?: Array<Record<string, unknown>> };
    };

    expect(res.status).toBe(200);
    expect(body.task?.isBlind).toBe(true);
    expect(body.task?.responses?.[0]?.modelName).toBe("Модель A");
    expect(body.task?.responses?.[0]).not.toHaveProperty("modelKey");
    expect(JSON.stringify(body)).not.toContain("provider/real-a");
    expect(JSON.stringify(body)).not.toContain("Real Model A");
  });

  it("reveals model identity for blind tasks after a best vote exists", async () => {
    const responseId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    supabaseMock.single.mockResolvedValue({
      data: {
        ...VALID_TASK_ROW,
        is_blind: true,
        model_responses: [
          {
            id: responseId,
            model_key: "provider/real-a",
            display_name: "Real Model A",
            status: "success",
            response_text: "answer a",
            latency_ms: 100,
            error_code: null,
            error_message: null,
            created_at: "2026-06-28T00:00:01Z",
          },
        ],
      },
      error: null,
    });
    supabaseMock.maybeSingle.mockResolvedValue({
      data: { model_response_id: responseId },
      error: null,
    });

    const res = await GET(makeRequest(TASK_ID), { params: Promise.resolve({ taskId: TASK_ID }) });
    const body = await res.json() as {
      task?: { responses?: Array<Record<string, unknown>> };
    };

    expect(res.status).toBe(200);
    expect(body.task?.responses?.[0]?.modelName).toBe("Real Model A");
    expect(body.task?.responses?.[0]?.modelKey).toBe("provider/real-a");
    expect(supabaseMock.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});
