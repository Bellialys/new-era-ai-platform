import { describe, expect, it } from "vitest";
import { fingerprintCompareRequest, parseCompareIdempotencyKey } from "./compare-idempotency";

const VALID_KEY = "a0b1c2d3-1234-4abc-8abc-1234567890ab";
const BASE = {
  route: "compare" as const,
  prompt: "Compare these two answers",
  modelIds: ["model-a", "model-b"],
  modeSlug: "prompt-arena",
  stream: false,
  blind: false,
};

describe("parseCompareIdempotencyKey", () => {
  it("accepts and canonicalizes a client UUID v4", () => {
    expect(parseCompareIdempotencyKey(VALID_KEY.toUpperCase())).toEqual({
      valid: true, key: VALID_KEY, suppliedByClient: true,
    });
  });

  it("issues a new UUID v4 when the legacy client sends no header", () => {
    const first = parseCompareIdempotencyKey(null);
    const second = parseCompareIdempotencyKey(null);
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    if (!first.valid || !second.valid) throw new Error("Unexpected invalid generated key");
    expect(first.suppliedByClient).toBe(false);
    expect(first.key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(first.key).not.toBe(second.key);
  });

  it.each(["", "not-a-uuid", "  " + VALID_KEY, VALID_KEY + " ",
    VALID_KEY + "\r\nX-Injected: true",
    "00000000-0000-1000-8000-000000000000",
    "x".repeat(1000),
  ])("rejects malformed/untrusted value %s", (value) => {
    expect(parseCompareIdempotencyKey(value)).toMatchObject({ valid: false });
  });
});

describe("fingerprintCompareRequest", () => {
  it("is deterministic for equivalent validated requests", () => {
    const a = fingerprintCompareRequest(BASE);
    const b = fingerprintCompareRequest({ ...BASE, modelIds: [...BASE.modelIds] });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes for model ordering and prompt contents", () => {
    const expected = fingerprintCompareRequest(BASE);
    expect(fingerprintCompareRequest({ ...BASE, modelIds: ["model-b", "model-a"] }))
      .not.toBe(expected);
    expect(fingerprintCompareRequest({ ...BASE, prompt: "Different user intention" }))
      .not.toBe(expected);
  });

  it("changes for endpoint, streaming and blind-mode flags", () => {
    const expected = fingerprintCompareRequest(BASE);
    expect(fingerprintCompareRequest({ ...BASE, route: "stream-compare" })).not.toBe(expected);
    expect(fingerprintCompareRequest({ ...BASE, stream: true })).not.toBe(expected);
    expect(fingerprintCompareRequest({ ...BASE, blind: true })).not.toBe(expected);
    expect(fingerprintCompareRequest({ ...BASE, modeSlug: "code-arena" })).not.toBe(expected);
  });
});
