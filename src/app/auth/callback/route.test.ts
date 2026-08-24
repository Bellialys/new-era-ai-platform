import { describe, expect, it } from "vitest";
import { safeNextPath } from "./route";

describe("safeNextPath", () => {
  it.each([
    "https://attacker.example/phish",
    "//attacker.example/phish",
    "/\\attacker.example/phish",
    "\\attacker.example/phish",
  ])("rejects an external redirect representation: %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("preserves an ordinary same-origin path, query and fragment", () => {
    expect(safeNextPath("/profile?tab=security#sessions")).toBe(
      "/profile?tab=security#sessions"
    );
  });
});
