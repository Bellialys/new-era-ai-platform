import { describe, it, expect } from "vitest";
import {
  ALLOWED_MODELS,
  getAvailableModels,
  getModelById,
  validateModelAllowlist,
} from "./models";
import { ApiError } from "./utils";

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

describe("getAvailableModels", () => {
  it("returns one entry per allowed model", () => {
    expect(getAvailableModels()).toHaveLength(ALLOWED_MODELS.length);
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

describe("validateModelAllowlist", () => {
  it("passes when all ids are allowed", () => {
    expect(() => validateModelAllowlist([ALLOWED_MODELS[0].id])).not.toThrow();
  });

  it("throws ApiError 403 for a disallowed id", () => {
    try {
      validateModelAllowlist(["evil/model"]);
      throw new Error("expected validateModelAllowlist to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).statusCode).toBe(403);
    }
  });
});
