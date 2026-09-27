import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/app/admin/page.tsx"), "utf8");

describe("admin dashboard server-side authorization boundary", () => {
  it("authorizes before opening the service-role database client", () => {
    const guardIndex = source.indexOf("await requireAdmin()");
    const serviceClientIndex = source.indexOf("getSupabaseServerClient()");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(serviceClientIndex).toBeGreaterThan(guardIndex);
  });
});
