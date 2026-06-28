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
  prompt_text: "Hello world",
  title: null,
  status: "completed",
  created_at: "2026-06-28T00:00:00Z",
  settings: {},
  judge_verdict: null,
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

  // Default: authenticated user
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  // Default: task found and owned
  supabaseMock.single.mockResolvedValue({ data: VALID_TASK_ROW, error: null });
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
});
