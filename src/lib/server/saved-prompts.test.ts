import { describe, expect, it } from "vitest";
import { ApiError } from "./utils";
import {
  parseSavedPromptInput,
  toSavedPromptDto,
  SAVED_PROMPT_LIST_LIMIT,
} from "./saved-prompts";

describe("saved prompt validation", () => {
  it("trims valid create fields", () => {
    expect(parseSavedPromptInput({
      title: "  Review  ", promptText: "  Explain code  ",
    }, "create")).toEqual({ title: "Review", prompt_text: "Explain code" });
  });

  it.each([
    [null], [[]], ["text"], [3],
    [{ title: "abc" }],
    [{ promptText: "a valid prompt" }],
    [{ title: " ", promptText: "valid" }],
    [{ title: "valid", promptText: "ab" }],
    [{ title: "x".repeat(81), promptText: "valid" }],
    [{ title: "valid", promptText: "p".repeat(8001) }],
    [{ title: 4, promptText: "valid" }],
    [{ title: "valid", promptText: null }],
    [{ title: "valid", promptText: "valid", user_id: "victim" }],
  ])("rejects invalid create payload %#", (payload) => {
    expect(() => parseSavedPromptInput(payload, "create")).toThrow(ApiError);
  });

  it("accepts partial updates but rejects empty updates", () => {
    expect(parseSavedPromptInput({ title: " New " }, "update"))
      .toEqual({ title: "New" });
    expect(parseSavedPromptInput({ promptText: " New prompt " }, "update"))
      .toEqual({ prompt_text: "New prompt" });
    expect(() => parseSavedPromptInput({}, "update")).toThrow(ApiError);
  });

  it("maps only public DTO fields", () => {
    const item = toSavedPromptDto({
      id: "id", title: "Title", prompt_text: "Prompt",
      created_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z",
    });
    expect(item).toEqual({
      id: "id", title: "Title", promptText: "Prompt",
      createdAt: "2026-11-09T00:00:00Z", updatedAt: "2026-11-09T00:00:00Z",
    });
    expect(SAVED_PROMPT_LIST_LIMIT).toBeLessThanOrEqual(50);
  });
});
