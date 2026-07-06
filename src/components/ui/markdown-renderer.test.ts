import { describe, expect, it } from "vitest";
import { sanitizeMarkdownUrl } from "./markdown-renderer";

describe("sanitizeMarkdownUrl", () => {
  it("allows http, https, mailto, root-relative, and hash links", () => {
    expect(sanitizeMarkdownUrl("https://example.com")).toBe("https://example.com");
    expect(sanitizeMarkdownUrl("http://example.com")).toBe("http://example.com");
    expect(sanitizeMarkdownUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
    expect(sanitizeMarkdownUrl("/docs")).toBe("/docs");
    expect(sanitizeMarkdownUrl("#section")).toBe("#section");
  });

  it("blocks executable and ambiguous URL schemes", () => {
    expect(sanitizeMarkdownUrl("javascript:alert(1)")).toBeUndefined();
    expect(sanitizeMarkdownUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(sanitizeMarkdownUrl("vbscript:msgbox(1)")).toBeUndefined();
    expect(sanitizeMarkdownUrl("example.com/path")).toBeUndefined();
  });
});
