import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminMock,
  checkAdminMutationRateLimitMock,
  getClientMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  checkAdminMutationRateLimitMock: vi.fn(),
  getClientMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    requireAdmin: requireAdminMock,
    checkAdminMutationRateLimit: checkAdminMutationRateLimitMock,
    logApiRequest: vi.fn(),
  };
});

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseServerClient: getClientMock,
}));

import { PATCH } from "./route";

const ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const MODEL_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/models/${MODEL_ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(id = MODEL_ID) {
  return { params: Promise.resolve({ id }) };
}

function notLimited() {
  return { limited: false, remaining: 9, resetAt: Date.now() + 60_000 };
}

function limited() {
  return { limited: true, remaining: 0, resetAt: Date.now() + 30_000 };
}

function createModelsClient(error: { code?: string; message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { client: { rpc }, rpc };
}

beforeEach(() => {
  requireAdminMock.mockReset();
  checkAdminMutationRateLimitMock.mockReset();
  getClientMock.mockReset();

  requireAdminMock.mockResolvedValue({ userId: ACTOR_ID });
  checkAdminMutationRateLimitMock.mockResolvedValue(notLimited());
  getClientMock.mockReturnValue(createModelsClient().client);
});

describe("PATCH /api/admin/models/[id] admin safety", () => {
  it("rate-limits admin model mutations before opening a DB client", async () => {
    checkAdminMutationRateLimitMock.mockResolvedValue(limited());

    const res = await PATCH(makeRequest({ access_level: "premium" }), makeContext());
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(checkAdminMutationRateLimitMock).toHaveBeenCalledWith(ACTOR_ID, "models.patch");
    expect(getClientMock).not.toHaveBeenCalled();
  });

  it("delegates the model mutation and mandatory audit insert to one RPC transaction", async () => {
    const mockDb = createModelsClient();
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(
      makeRequest({ is_active: false, name: "New Name", access_level: "premium" }),
      makeContext()
    );

    expect(res.status).toBe(200);
    expect(checkAdminMutationRateLimitMock).toHaveBeenCalledWith(ACTOR_ID, "models.patch");
    expect(mockDb.rpc).toHaveBeenCalledWith("admin_update_model_with_audit", {
      p_actor_id: ACTOR_ID,
      p_target_id: MODEL_ID,
      p_updates: {
        is_active: false,
        display_name: "New Name",
        access_level: "premium",
      },
    });
  });

  it("fails closed when the atomic model mutation RPC fails", async () => {
    const mockDb = createModelsClient({ code: "23503", message: "audit insert failed" });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ is_active: false }), makeContext());
    const body = (await res.json()) as { errorCode?: string };

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });
});
