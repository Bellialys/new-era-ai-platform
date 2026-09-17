import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./markdown-renderer";

describe("MarkdownRenderer image privacy", () => {
  it.each([
    "https://tracker.example/pixel.png",
    "//tracker.example/pixel.png",
    "/\\tracker.example/pixel.png",
  ])("does not render an attacker-controlled image request: %s", (source) => {
    const html = renderToStaticMarkup(
      createElement(MarkdownRenderer, { content: `![tracking pixel](${source})` })
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("tracker.example");
    expect(html).toContain("Внешнее изображение заблокировано");
  });

  it("preserves a legitimate same-origin Markdown image", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownRenderer, { content: "![diagram](/assets/diagram.png)" })
    );

    expect(html).toContain('<img src="/assets/diagram.png"');
    expect(html).toContain('referrerPolicy="no-referrer"');
  });
});
