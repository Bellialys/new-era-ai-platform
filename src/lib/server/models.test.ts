import { describe, it, expect } from "vitest";
import { ALLOWED_MODELS, getModelById } from "./models";

describe("ALLOWED_MODELS", () => {
  it("only contains free OpenRouter models with unique ids", () => {
    const ids = ALLOWED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of ALLOWED_MODELS) {
      expect(model.provider).toBe("openrouter");
      expect(model.id.endsWith(":free")).toBe(true);
      expect(model.name.length).toBeGreaterThan(0);
      expect(model.role.length).toBeGreaterThan(0);
    }
  });
});

describe("getModelById", () => {
  it("finds a known model", () => {
    expect(getModelById(ALLOWED_MODELS[0].id)?.id).toBe(ALLOWED_MODELS[0].id);
  });

  it("returns undefined for an unknown model", () => {
    expect(getModelById("does/not-exist")).toBeUndefined();
  });
});
