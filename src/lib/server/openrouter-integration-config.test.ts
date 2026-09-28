import { describe, expect, it } from "vitest";
import {
  isOpenRouterOAuthBetaAvailable,
  isOpenRouterUserOAuthEnabled,
  isProviderCredentialPersistenceEnabled,
} from "./openrouter-integration-config";

describe("OpenRouter integration rollout gates", () => {
  it("defaults both security-sensitive gates to disabled", () => {
    const env = {} as NodeJS.ProcessEnv;
    expect(isOpenRouterUserOAuthEnabled(env)).toBe(false);
    expect(isProviderCredentialPersistenceEnabled(env)).toBe(false);
    expect(isOpenRouterOAuthBetaAvailable(env)).toBe(false);
  });

  it("requires both OAuth rollout and credential persistence gates", () => {
    expect(
      isOpenRouterOAuthBetaAvailable({
        ENABLE_OPENROUTER_USER_OAUTH: "true",
      } as NodeJS.ProcessEnv)
    ).toBe(false);

    expect(
      isOpenRouterOAuthBetaAvailable({
        ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE: "true",
      } as NodeJS.ProcessEnv)
    ).toBe(false);

    expect(
      isOpenRouterOAuthBetaAvailable({
        ENABLE_OPENROUTER_USER_OAUTH: "true",
        ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE: "true",
      } as NodeJS.ProcessEnv)
    ).toBe(true);
  });
});
