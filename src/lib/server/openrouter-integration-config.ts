export const OPENROUTER_USER_OAUTH_FLAG = "ENABLE_OPENROUTER_USER_OAUTH";
export const PROVIDER_CREDENTIAL_PERSISTENCE_FLAG =
  "ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE";

export function isOpenRouterUserOAuthEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.ENABLE_OPENROUTER_USER_OAUTH === "true";
}

export function isProviderCredentialPersistenceEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE === "true";
}

export function isOpenRouterOAuthBetaAvailable(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    isOpenRouterUserOAuthEnabled(env) &&
    isProviderCredentialPersistenceEnabled(env)
  );
}
