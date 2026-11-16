import { describe, expect, it } from "vitest";
import { publicModelFailureMessage } from "./model-error-guidance";

describe("public model error guidance", () => {
  it("explains transient free-provider limits", () => {
    expect(publicModelFailureMessage("RATE_LIMIT")).toContain("лимит запросов");
    expect(publicModelFailureMessage("429")).toContain("OpenRouter");
  });
  it("explains missing or retired model endpoints", () => {
    expect(publicModelFailureMessage("404")).toContain("недоступна");
    expect(publicModelFailureMessage("NO_ENDPOINTS_FOUND")).toContain("недоступна");
  });
  it("explains timeout, credentials and provider empty responses", () => {
    expect(publicModelFailureMessage("TIMEOUT")).toContain("не ответил");
    expect(publicModelFailureMessage("INSUFFICIENT_CREDITS")).toContain("Лимит средств");
    expect(publicModelFailureMessage("AUTH_ERROR")).toContain("OpenRouter");
    expect(publicModelFailureMessage("INVALID_RESPONSE")).toContain("пустой");
  });
  it("never reflects arbitrary untrusted provider errors", () => {
    expect(publicModelFailureMessage("credential_x1_secret")).not.toContain("credential_x1_secret");
    expect(publicModelFailureMessage("<script>alert(1)</script>")).not.toContain("<script>");
  });
});
