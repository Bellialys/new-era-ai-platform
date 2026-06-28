import { describe, it, expect, vi } from "vitest";

// Mock @supabase/ssr so no real credentials are needed.
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
  }),
}));

import { proxy, config } from "./proxy";

describe("proxy (Next.js 16 middleware)", () => {
  it("exports a proxy function", () => {
    expect(typeof proxy).toBe("function");
  });

  it("exports a config object with a matcher array", () => {
    expect(Array.isArray(config.matcher)).toBe(true);
    expect(config.matcher.length).toBeGreaterThan(0);
  });

  it("matcher pattern excludes static assets", () => {
    const pattern = config.matcher[0];
    expect(typeof pattern).toBe("string");
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });

  it("returns a NextResponse for a normal request", async () => {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest("http://localhost/api/health", { method: "GET" });
    const res = await proxy(req);
    expect(res).toBeDefined();
    expect(typeof res.status).toBe("number");
  });
});
