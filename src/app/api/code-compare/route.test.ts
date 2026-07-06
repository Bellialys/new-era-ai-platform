import { describe, expect, it } from "vitest";
import { validateCodeFramework } from "./route";

describe("validateCodeFramework", () => {
  it("accepts empty framework values", () => {
    expect(validateCodeFramework(null, "TypeScript")).toEqual({ valid: true, value: null });
    expect(validateCodeFramework("", "TypeScript")).toEqual({ valid: true, value: null });
    expect(validateCodeFramework("   ", "TypeScript")).toEqual({ valid: true, value: null });
  });

  it("accepts frameworks from the selected language allowlist", () => {
    expect(validateCodeFramework("Next.js", "TypeScript")).toEqual({
      valid: true,
      value: "Next.js",
    });
  });

  it("rejects free-form framework strings before they reach the system prompt", () => {
    expect(validateCodeFramework("$(curl attacker)", "TypeScript")).toMatchObject({
      valid: false,
      error: expect.stringContaining("Framework must be one of"),
    });
  });
});
