import { describe, it, expect } from "vitest";
import { modeLabel, statusLabel, pluralModels } from "./format";

describe("modeLabel", () => {
  it("returns 'Prompt Arena' for prompt-arena", () => {
    expect(modeLabel("prompt-arena")).toBe("Prompt Arena");
  });

  it("returns 'Code Arena' for code-arena", () => {
    expect(modeLabel("code-arena")).toBe("Code Arena");
  });

  it("returns 'AI Team Mode' for ai-team-mode", () => {
    expect(modeLabel("ai-team-mode")).toBe("AI Team Mode");
  });

  it("returns 'Image Arena' for image-arena", () => {
    expect(modeLabel("image-arena")).toBe("Image Arena");
  });

  it("returns 'Multi-Model Battle' for multi-model-battle", () => {
    expect(modeLabel("multi-model-battle")).toBe("Multi-Model Battle");
  });

  it("returns 'Judge Mode' for judge-mode", () => {
    expect(modeLabel("judge-mode")).toBe("Judge Mode");
  });

  it("returns the raw slug unchanged for an unknown mode", () => {
    expect(modeLabel("some-future-mode")).toBe("some-future-mode");
  });

  it("does not throw for an empty string", () => {
    expect(() => modeLabel("")).not.toThrow();
    expect(modeLabel("")).toBe("");
  });
});

describe("statusLabel", () => {
  it("returns Russian label for 'completed'", () => {
    expect(statusLabel("completed")).toBe("Завершено");
  });

  it("returns Russian label for 'failed'", () => {
    expect(statusLabel("failed")).toBe("Ошибка");
  });

  it("returns Russian label for 'partial'", () => {
    expect(statusLabel("partial")).toBe("Частично");
  });

  it("returns Russian label for 'running'", () => {
    expect(statusLabel("running")).toBe("Выполняется");
  });

  it("returns the raw status for an unknown value", () => {
    expect(statusLabel("unknown-status")).toBe("unknown-status");
  });
});

describe("pluralModels", () => {
  it("returns 'модель' for 1", () => {
    expect(pluralModels(1)).toBe("модель");
  });

  it("returns 'модели' for 2", () => {
    expect(pluralModels(2)).toBe("модели");
  });

  it("returns 'модели' for 4", () => {
    expect(pluralModels(4)).toBe("модели");
  });

  it("returns 'моделей' for 5", () => {
    expect(pluralModels(5)).toBe("моделей");
  });

  it("returns 'моделей' for 11 (exception: 11 uses genitive plural despite ending in 1)", () => {
    expect(pluralModels(11)).toBe("моделей");
  });

  it("returns 'моделей' for 12-14 (exception block)", () => {
    expect(pluralModels(12)).toBe("моделей");
    expect(pluralModels(13)).toBe("моделей");
    expect(pluralModels(14)).toBe("моделей");
  });

  it("returns 'модель' for 21", () => {
    expect(pluralModels(21)).toBe("модель");
  });

  it("returns 'модели' for 22", () => {
    expect(pluralModels(22)).toBe("модели");
  });
});
