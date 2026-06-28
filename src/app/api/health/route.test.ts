import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const { getAvailableModelsMock } = vi.hoisted(() => ({
  getAvailableModelsMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getAvailableModels: getAvailableModelsMock,
    getSupabaseServerClient: vi.fn().mockReturnValue(null), // default: no DB
    logApiRequest: vi.fn(),
  };
});

import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_SECRET = "super-secret-health-key";

function makeRequest(secret?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["x-health-secret"] = secret;
  }
  return new NextRequest("http://localhost/api/health", {
    method: "GET",
    headers,
  });
}

beforeEach(() => {
  getAvailableModelsMock.mockReset();
  // Default: catalog returns some models
  getAvailableModelsMock.mockResolvedValue([{ id: "m1" }, { id: "m2" }]);

  // Reset env
  delete process.env.HEALTH_CHECK_SECRET;
  delete process.env.VERCEL_ENV;
  delete process.env.VERCEL_GIT_COMMIT_SHA;
});

// ---------------------------------------------------------------------------
// Public response (no secret or wrong secret)
// ---------------------------------------------------------------------------

describe("GET /api/health — public response (no/wrong secret)", () => {
  it("returns { status: 'ok' } without diagnostic details when no header is provided", async () => {
    process.env.HEALTH_CHECK_SECRET = VALID_SECRET;

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    // Must NOT expose internal diagnostics
    expect(body.services).toBeUndefined();
    expect(body.vercel).toBeUndefined();
  });

  it("returns { status: 'ok' } without diagnostics when the wrong secret is provided", async () => {
    process.env.HEALTH_CHECK_SECRET = VALID_SECRET;

    const res = await GET(makeRequest("wrong-secret"));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.services).toBeUndefined();
  });

  it("returns minimal public response when HEALTH_CHECK_SECRET is not configured (fail-safe)", async () => {
    // Secret not set → always return public response regardless of header
    const res = await GET(makeRequest(VALID_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, unknown>;
    expect(body.status).toBe("ok");
    expect(body.services).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Authorized detailed response
// ---------------------------------------------------------------------------

describe("GET /api/health — authorized detailed response", () => {
  it("returns full diagnostic details when the correct secret is provided", async () => {
    process.env.HEALTH_CHECK_SECRET = VALID_SECRET;
    process.env.VERCEL_ENV = "preview";

    const res = await GET(makeRequest(VALID_SECRET));

    expect(res.status).toBe(200);
    const body = await res.json() as {
      status?: string;
      services?: { supabase?: unknown; openRouter?: unknown; modelCatalog?: unknown };
      vercel?: { environment?: string };
    };
    // Full response must include all diagnostic fields
    expect(body.services).toBeDefined();
    expect(body.services?.supabase).toBeDefined();
    expect(body.services?.openRouter).toBeDefined();
    expect(body.services?.modelCatalog).toBeDefined();
    expect(body.vercel?.environment).toBe("preview");
  });

  it("reports degraded status when the model catalog is empty", async () => {
    process.env.HEALTH_CHECK_SECRET = VALID_SECRET;
    getAvailableModelsMock.mockResolvedValue([]);

    const res = await GET(makeRequest(VALID_SECRET));
    const body = await res.json() as { status?: string };

    expect(body.status).toBe("degraded");
  });
});
