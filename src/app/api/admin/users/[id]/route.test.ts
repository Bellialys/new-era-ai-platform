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
const TARGET_ID = "22222222-2222-4222-8222-222222222222";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${TARGET_ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeContext(id = TARGET_ID) {
  return { params: Promise.resolve({ id }) };
}

function notLimited() {
  return { limited: false, remaining: 9, resetAt: Date.now() + 60_000 };
}

function limited() {
  return { limited: true, remaining: 0, resetAt: Date.now() + 30_000 };
}

function createProfilesClient(error: { code?: string; message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  return { client: { rpc }, rpc };
}

beforeEach(() => {
  requireAdminMock.mockReset();
  checkAdminMutationRateLimitMock.mockReset();
  getClientMock.mockReset();

  requireAdminMock.mockResolvedValue({ userId: ACTOR_ID });
  checkAdminMutationRateLimitMock.mockResolvedValue(notLimited());
  getClientMock.mockReturnValue(createProfilesClient().client);
});

describe("PATCH /api/admin/users/[id] admin safety", () => {
  it("rate-limits admin user mutations before opening a DB client", async () => {
    checkAdminMutationRateLimitMock.mockResolvedValue(limited());

    const res = await PATCH(makeRequest({ role: "user" }), makeContext());
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(checkAdminMutationRateLimitMock).toHaveBeenCalledWith(ACTOR_ID, "users.patch");
    expect(getClientMock).not.toHaveBeenCalled();
  });

  it("maps the transactional self-demotion rejection", async () => {
    const mockDb = createProfilesClient({ code: "P0001", message: "ADMIN_SELF_DEMOTION" });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(ACTOR_ID));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(409);
    expect(body.errorCode).toBe("ADMIN_SELF_DEMOTION");
    expect(mockDb.rpc).toHaveBeenCalledOnce();
  });

  it("maps the database last-admin invariant rejection", async () => {
    const mockDb = createProfilesClient({ code: "P0001", message: "ADMIN_LAST_ADMIN" });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(TARGET_ID));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(409);
    expect(body.errorCode).toBe("ADMIN_LAST_ADMIN");
    expect(mockDb.rpc).toHaveBeenCalledOnce();
  });

  it("delegates the mutation and mandatory audit insert to one RPC transaction", async () => {
    const mockDb = createProfilesClient();
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(TARGET_ID));

    expect(res.status).toBe(200);
    expect(checkAdminMutationRateLimitMock).toHaveBeenCalledWith(ACTOR_ID, "users.patch");
    expect(mockDb.rpc).toHaveBeenCalledWith("admin_update_user_with_audit", {
      p_actor_id: ACTOR_ID,
      p_target_id: TARGET_ID,
      p_updates: { role: "user" },
    });
  });

  it("fails closed when the atomic mutation RPC fails", async () => {
    const mockDb = createProfilesClient({ code: "23503", message: "audit insert failed" });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ plan: "pro" }), makeContext());
    const body = (await res.json()) as { errorCode?: string };

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });
});
