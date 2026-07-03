import { describe, it, expect, vi } from "vitest";
import {
  ApiError,
  TimeoutError,
  createErrorResponse,
  isUuid,
  logApiRequest,
  validatePrompt,
  validateModelIds,
  validateModeSlug,
  withTimeout,
} from "./utils";
import { MODE_SLUG_CODE_ARENA, MODE_SLUG_PROMPT_ARENA } from "@/lib/arena/constants";

describe("validatePrompt", () => {
  it("rejects non-string input", () => {
    expect(validatePrompt(123, 3, 8000).valid).toBe(false);
    expect(validatePrompt(undefined, 3, 8000).valid).toBe(false);
  });

  it("trims and accepts a valid prompt", () => {
    const result = validatePrompt("  hello world  ", 3, 8000);
    expect(result.valid).toBe(true);
    expect(result.value).toBe("hello world");
  });

  it("rejects prompts shorter than min length after trimming", () => {
    expect(validatePrompt("  a  ", 3, 8000).valid).toBe(false);
  });

  it("rejects prompts longer than max length", () => {
    expect(validatePrompt("a".repeat(9000), 3, 8000).valid).toBe(false);
  });
});

describe("validateModelIds", () => {
  it("requires an array", () => {
    expect(validateModelIds("a,b", 2, 3).valid).toBe(false);
  });

  it("enforces min and max selection", () => {
    expect(validateModelIds(["a"], 2, 3).valid).toBe(false);
    expect(validateModelIds(["a", "b", "c", "d"], 2, 3).valid).toBe(false);
  });

  it("rejects empty strings and non-strings", () => {
    expect(validateModelIds(["a", "  "], 2, 3).valid).toBe(false);
    expect(validateModelIds(["a", 5], 2, 3).valid).toBe(false);
  });

  it("rejects duplicates", () => {
    expect(validateModelIds(["a", "a"], 2, 3).valid).toBe(false);
  });

  it("trims and returns normalized ids", () => {
    const result = validateModelIds([" a ", "b"], 2, 3);
    expect(result.valid).toBe(true);
    expect(result.value).toEqual(["a", "b"]);
  });
});

describe("validateModeSlug", () => {
  it("falls back when empty", () => {
    const result = validateModeSlug(undefined, MODE_SLUG_PROMPT_ARENA);
    expect(result.valid).toBe(true);
    expect(result.value).toBe(MODE_SLUG_PROMPT_ARENA);
  });

  it("accepts an allowed slug", () => {
    expect(validateModeSlug(MODE_SLUG_PROMPT_ARENA, MODE_SLUG_PROMPT_ARENA).valid).toBe(true);
    expect(validateModeSlug(MODE_SLUG_CODE_ARENA, MODE_SLUG_PROMPT_ARENA).valid).toBe(true);
  });

  it("rejects an unknown slug", () => {
    expect(validateModeSlug("image-arena", MODE_SLUG_PROMPT_ARENA).valid).toBe(false);
  });

  it("rejects a non-string slug", () => {
    expect(validateModeSlug(42, MODE_SLUG_PROMPT_ARENA).valid).toBe(false);
  });
});

describe("createErrorResponse", () => {
  it("preserves ApiError code and message", () => {
    const response = createErrorResponse(new ApiError(429, "RATE_LIMIT", "slow down"));
    expect(response).toEqual({ status: "error", errorCode: "RATE_LIMIT", message: "slow down" });
  });

  it("hides details of unknown errors", () => {
    const response = createErrorResponse(new Error("internal db dsn leaked"));
    expect(response.errorCode).toBe("INTERNAL_ERROR");
    expect(response.message).not.toContain("dsn");
  });

  it("includes requestId when provided and omits it otherwise", () => {
    const withId = createErrorResponse(new ApiError(404, "TASK_NOT_FOUND", "nope"), "req-1");
    expect(withId).toEqual({
      status: "error",
      errorCode: "TASK_NOT_FOUND",
      message: "nope",
      requestId: "req-1",
    });

    const withoutId = createErrorResponse(new ApiError(404, "TASK_NOT_FOUND", "nope"));
    expect(withoutId).not.toHaveProperty("requestId");
  });
});

describe("isUuid", () => {
  it("accepts a valid uuid", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
  });

  it("rejects malformed or non-string values", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("withTimeout", () => {
  it("returns the operation result when it completes in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "fast operation")).resolves.toBe("ok");
  });

  it("rejects with TimeoutError when the operation does not complete in time", async () => {
    await expect(withTimeout(new Promise(() => {}), 1, "slow operation")).rejects.toBeInstanceOf(
      TimeoutError
    );
  });
});

describe("logApiRequest", () => {
  it("appends rid only when a requestId is supplied", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logApiRequest("GET", "/api/history", 200, 5, "req-9");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("rid=req-9"));

    warn.mockClear();
    logApiRequest("GET", "/api/history", 200, 5);
    expect(warn).toHaveBeenCalledWith(expect.not.stringContaining("rid="));

    warn.mockRestore();
  });
});
