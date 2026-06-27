import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Mock the server lib so we can control requireAdmin() and the DB client
// independently of real auth infrastructure.
// ---------------------------------------------------------------------------

const { requireAdminMock } = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    requireAdmin: requireAdminMock,
    logApiRequest: vi.fn(), // silence log output in tests
  };
});

vi.mock("@/lib/server/supabase", () => ({ getSupabaseServerClient: vi.fn() }));

import { GET } from "./route";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import { ApiError } from "@/lib/server";

const mockedGetClient = vi.mocked(getSupabaseServerClient);

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeRequest(url = "http://localhost/api/admin/audit"): NextRequest {
  return new NextRequest(url);
}

/** Minimal audit_log + profiles mock for the happy path. */
function makeAdminDbClient() {
  const auditQuery = {
    select: vi.fn(function () { return auditQuery; }),
    order: vi.fn(function () { return auditQuery; }),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const profilesQuery = {
    select: vi.fn(function () { return profilesQuery; }),
    in: vi.fn(() => Promise.resolve({ data: [], error: null })),
  };
  const client = {
    from: vi.fn((table: string) =>
      table === "audit_log" ? auditQuery : profilesQuery
    ),
  };
  return client as unknown as ReturnType<typeof getSupabaseServerClient>;
}

beforeEach(() => {
  requireAdminMock.mockReset();
  mockedGetClient.mockReset();
});

describe("GET /api/admin/audit — auth guard", () => {
  it("returns 403 when the caller is not authenticated", async () => {
    requireAdminMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Admin access required")
    );

    const res = await GET(makeRequest());
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(403);
    expect(body.errorCode).toBe("FORBIDDEN");
  });

  it("returns 403 when the caller is authenticated but not an admin", async () => {
    requireAdminMock.mockRejectedValue(
      new ApiError(403, "FORBIDDEN", "Admin access required")
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    // DB must never be reached when auth is denied.
    expect(mockedGetClient).not.toHaveBeenCalled();
  });

  it("returns 500 when DB is not configured (after passing admin check)", async () => {
    requireAdminMock.mockResolvedValue({ userId: ADMIN_ID });
    mockedGetClient.mockReturnValue(null);

    const res = await GET(makeRequest());
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });

  it("returns 200 with an entries array on success", async () => {
    requireAdminMock.mockResolvedValue({ userId: ADMIN_ID });
    mockedGetClient.mockReturnValue(makeAdminDbClient());

    const res = await GET(makeRequest());
    const body = await res.json() as { entries?: unknown[] };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.entries)).toBe(true);
  });
});
