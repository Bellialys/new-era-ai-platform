import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const guardedRoutes = [
  "src/app/api/compare/route.ts",
  "src/app/api/stream-compare/route.ts",
  "src/app/api/code-compare/route.ts",
  "src/app/api/code-run/route.ts",
  "src/app/api/image-compare/route.ts",
  "src/app/api/team-run/route.ts",
  "src/app/api/vote/route.ts",
  "src/app/api/profile/route.ts",
  "src/app/api/judge/route.ts",
  "src/app/api/admin/users/[id]/route.ts",
  "src/app/api/admin/models/[id]/route.ts",
] as const;

describe("JSON object boundaries", () => {
  it.each(guardedRoutes)("%s rejects scalar/array JSON before field access", (routePath) => {
    const source = readFileSync(resolve(process.cwd(), routePath), "utf8");

    expect(source).toContain("request.json()");
    expect(source).toContain("isJsonObject(body)");
  });
});
