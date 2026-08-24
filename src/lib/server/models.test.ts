import { describe, it, expect } from "vitest";
import { ALLOWED_MODELS } from "./models";

const EXPECTED_MODEL_IDS = [
  "z-ai/glm-5.2:free",
  "thinkingmachines/inkling:free",
  "thinkingmachines/inkling-small:free",
  "nvidia/nemotron-3.5-lightning:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
  "liquid/lfm-2.5-2.6b:free",
] as const;

const EXPECTED_CODE_MODEL_IDS = [
  "poolside/laguna-s-2.1:free",
  "poolside/laguna-xs-2.1:free",
  "cohere/north-mini-code:free",
] as const;

describe("ALLOWED_MODELS", () => {
  it("matches the verified provider-recovery catalog exactly", () => {
    expect(ALLOWED_MODELS.map((model) => model.id)).toEqual(EXPECTED_MODEL_IDS);
  });

  it("only contains free OpenRouter models with unique ids", () => {
    const ids = ALLOWED_MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const model of ALLOWED_MODELS) {
      expect(model.provider).toBe("openrouter");
      expect(model.id.endsWith(":free")).toBe(true);
      expect(model.name.length).toBeGreaterThan(0);
      expect(model.role.length).toBeGreaterThan(0);
      expect(typeof model.supportsCode).toBe("boolean");
    }
  });

  it("marks the approved coding models with explicit capability metadata", () => {
    expect(ALLOWED_MODELS.filter((model) => model.supportsCode).map((model) => model.id)).toEqual(
      EXPECTED_CODE_MODEL_IDS
    );
  });
});
