import { describe, expect, it } from "vitest";
import { nextCompareIdempotencyTicket } from "./compare-idempotency";

const base = {
  prompt: "Compare these models",
  modelIds: ["model-a", "model-b"],
  blind: true,
};

describe("Prompt Arena idempotent browser submission", () => {
  it("reuses the original key on a retry of identical inputs", () => {
    let generated = 0;
    const generator = () => "request-" + ++generated;
    const first = nextCompareIdempotencyTicket(null, base, generator);
    const retry = nextCompareIdempotencyTicket(first, { ...base, modelIds: [...base.modelIds] }, generator);
    expect(retry).toBe(first);
    expect(retry.key).toBe("request-1");
    expect(generated).toBe(1);
  });

  it("issues a new key for a different prompt, selection or blind option", () => {
    let generated = 0;
    const generator = () => "request-" + ++generated;
    const first = nextCompareIdempotencyTicket(null, base, generator);
    const changedPrompt = nextCompareIdempotencyTicket(first, { ...base, prompt: "Changed" }, generator);
    const changedModel = nextCompareIdempotencyTicket(first, { ...base, modelIds: ["model-b", "model-a"] }, generator);
    const changedBlind = nextCompareIdempotencyTicket(first, { ...base, blind: false }, generator);
    expect([changedPrompt.key, changedModel.key, changedBlind.key]).toEqual([
      "request-2", "request-3", "request-4",
    ]);
  });

  it("issues a new key after successful completion clears the pending ticket", () => {
    const first = nextCompareIdempotencyTicket(null, base, () => "first");
    const second = nextCompareIdempotencyTicket(null, base, () => "second");
    expect(first.key).toBe("first");
    expect(second.key).toBe("second");
  });

  it("does not embed prompt text or selected models in the header value", () => {
    const ticket = nextCompareIdempotencyTicket(null, base, () => "opaque-id");
    expect(ticket.key).toBe("opaque-id");
    expect(ticket.fingerprint).toContain("prompt-arena");
    expect(ticket.fingerprint).toContain("Compare these models");
  });
});
