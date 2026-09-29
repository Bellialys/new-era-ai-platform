import { describe, expect, it } from "vitest";
import {
  normalizeOpenRouterPricingResponse,
  OPENROUTER_PRICING_STALE_AFTER_MS,
} from "./openrouter-pricing";

describe("normalizeOpenRouterPricingResponse", () => {
  it("converts OpenRouter per-token prompt/completion prices to per-million values", () => {
    const result = normalizeOpenRouterPricingResponse(
      {
        data: [
          {
            id: "provider/model-a",
            pricing: {
              prompt: "0.0000003",
              completion: "0.0000015",
              image: "0.04",
            },
          },
        ],
      },
      "2026-09-29T10:30:00.000Z",
      new Set(["provider/model-a"])
    );

    expect(result.missingModelIds).toEqual([]);
    expect(result.snapshots).toEqual([
      expect.objectContaining({
        modelKey: "provider/model-a",
        inputPricePerMillion: 0.3,
        outputPricePerMillion: 1.5,
        currency: "USD",
        source: "openrouter_models_api",
        rawPricing: expect.objectContaining({ image: "0.04" }),
      }),
    ]);
  });

  it("keeps non-token image/request pricing only in raw_pricing", () => {
    const result = normalizeOpenRouterPricingResponse(
      {
        data: [
          {
            id: "provider/image-model",
            pricing: {
              image: "0.08",
              request: "0.005",
            },
          },
        ],
      },
      "2026-09-29T10:30:00.000Z",
      new Set(["provider/image-model"])
    );

    expect(result.snapshots[0]).toMatchObject({
      inputPricePerMillion: null,
      outputPricePerMillion: null,
      rawPricing: { image: "0.08", request: "0.005" },
    });
  });

  it("reports curated models missing from the provider response", () => {
    const result = normalizeOpenRouterPricingResponse(
      { data: [] },
      "2026-09-29T10:30:00.000Z",
      new Set(["provider/model-a", "provider/model-b"])
    );

    expect(result.snapshots).toEqual([]);
    expect(result.missingModelIds).toEqual([
      "provider/model-a",
      "provider/model-b",
    ]);
  });

  it("uses a 24-hour freshness boundary", () => {
    expect(OPENROUTER_PRICING_STALE_AFTER_MS).toBe(86_400_000);
  });
});
