import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  requireAdminMock,
  checkAdminMutationRateLimitMock,
  logAuditEventMock,
  getClientMock,
} = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  checkAdminMutationRateLimitMock: vi.fn(),
  logAuditEventMock: vi.fn(),
  getClientMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    requireAdmin: requireAdminMock,
    checkAdminMutationRateLimit: checkAdminMutationRateLimitMock,
    logAuditEvent: logAuditEventMock,
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

function createProfilesClient({
  profile = { role: "admin", plan: "pro" },
  adminCount = 2,
  beforeError = null,
  countError = null,
  updateError = null,
}: {
  profile?: { role: string; plan: string } | null;
  adminCount?: number;
  beforeError?: unknown;
  countError?: unknown;
  updateError?: unknown;
} = {}) {
  const beforeQuery = {
    eq: vi.fn(function (this: typeof beforeQuery) { return this; }),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: beforeError }),
  };
  const countQuery = {
    eq: vi.fn().mockResolvedValue({ count: adminCount, error: countError }),
  };
  const updateQuery = {
    eq: vi.fn().mockResolvedValue({ error: updateError }),
  };
  const table = {
    select: vi.fn((_columns: string, options?: { count?: string; head?: boolean }) =>
      options?.count ? countQuery : beforeQuery
    ),
    update: vi.fn(() => updateQuery),
  };
  const client = {
    from: vi.fn(() => table),
  };

  return { client, table, beforeQuery, countQuery, updateQuery };
}

beforeEach(() => {
  requireAdminMock.mockReset();
  checkAdminMutationRateLimitMock.mockReset();
  logAuditEventMock.mockReset();
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

  it("blocks self-demotion before updating the profile", async () => {
    const mockDb = createProfilesClient({ profile: { role: "admin", plan: "pro" } });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(ACTOR_ID));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(409);
    expect(body.errorCode).toBe("ADMIN_SELF_DEMOTION");
    expect(mockDb.table.update).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it("blocks demotion of the final admin before updating the profile", async () => {
    const mockDb = createProfilesClient({
      profile: { role: "admin", plan: "pro" },
      adminCount: 1,
    });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(TARGET_ID));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(409);
    expect(body.errorCode).toBe("ADMIN_LAST_ADMIN");
    expect(mockDb.countQuery.eq).toHaveBeenCalledWith("role", "admin");
    expect(mockDb.table.update).not.toHaveBeenCalled();
    expect(logAuditEventMock).not.toHaveBeenCalled();
  });

  it("allows demoting another admin when at least one admin remains", async () => {
    const mockDb = createProfilesClient({
      profile: { role: "admin", plan: "pro" },
      adminCount: 2,
    });
    getClientMock.mockReturnValue(mockDb.client);

    const res = await PATCH(makeRequest({ role: "user" }), makeContext(TARGET_ID));

    expect(res.status).toBe(200);
    expect(checkAdminMutationRateLimitMock).toHaveBeenCalledWith(ACTOR_ID, "users.patch");
    expect(mockDb.table.update).toHaveBeenCalledWith({ role: "user" });
    expect(mockDb.updateQuery.eq).toHaveBeenCalledWith("id", TARGET_ID);
    expect(logAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: ACTOR_ID,
        action: "user.role_change",
        targetId: TARGET_ID,
      })
    );
  });
});
