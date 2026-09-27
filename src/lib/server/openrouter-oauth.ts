import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
export const OPENROUTER_AUTH_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
export const OPENROUTER_OAUTH_FLOW_TTL_SECONDS = 10 * 60;
export const OPENROUTER_OAUTH_METHOD = "S256" as const;

const CODE_MAX_LENGTH = 4096;

export interface OpenRouterPkceSession {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export interface OpenRouterTokenExchangeInput {
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}

export class OpenRouterOAuthError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_INVALID_INPUT"
      | "OAUTH_EXCHANGE_FAILED"
      | "OAUTH_INVALID_RESPONSE",
    message: string
  ) {
    super(message);
    this.name = "OpenRouterOAuthError";
  }
}

function randomBase64Url(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

export function createS256Challenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
}

export function createOpenRouterPkceSession(): OpenRouterPkceSession {
  const codeVerifier = randomBase64Url(48);
  return {
    codeVerifier,
    codeChallenge: createS256Challenge(codeVerifier),
    state: randomBase64Url(32),
  };
}

function isAllowedCallbackUrl(value: URL): boolean {
  if (value.protocol === "https:") return true;
  return value.protocol === "http:" && (value.hostname === "localhost" || value.hostname === "127.0.0.1");
}

export function buildOpenRouterAuthorizationUrl(input: {
  callbackUrl: string;
  codeChallenge: string;
  state: string;
}): string {
  let callback: URL;
  try {
    callback = new URL(input.callbackUrl);
  } catch {
    throw new OpenRouterOAuthError("OAUTH_INVALID_INPUT", "Invalid OAuth callback URL.");
  }

  if (!isAllowedCallbackUrl(callback)) {
    throw new OpenRouterOAuthError(
      "OAUTH_INVALID_INPUT",
      "OAuth callback must use HTTPS, except localhost development."
    );
  }

  if (!input.codeChallenge || !input.state) {
    throw new OpenRouterOAuthError("OAUTH_INVALID_INPUT", "OAuth PKCE parameters are missing.");
  }

  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", callback.toString());
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", OPENROUTER_OAUTH_METHOD);
  url.searchParams.set("state", input.state);
  return url.toString();
}

export function oauthStateMatches(expected: string, actual: string | null): boolean {
  if (!actual || expected.length !== actual.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export async function exchangeOpenRouterAuthorizationCode(
  input: OpenRouterTokenExchangeInput
): Promise<string> {
  const code = input.code.trim();
  const codeVerifier = input.codeVerifier.trim();

  if (!code || code.length > CODE_MAX_LENGTH || !codeVerifier) {
    throw new OpenRouterOAuthError("OAUTH_INVALID_INPUT", "Invalid OAuth callback parameters.");
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(OPENROUTER_AUTH_KEYS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        code,
        code_verifier: codeVerifier,
        code_challenge_method: OPENROUTER_OAUTH_METHOD,
      }),
      cache: "no-store",
      signal: input.signal,
    });
  } catch {
    throw new OpenRouterOAuthError("OAUTH_EXCHANGE_FAILED", "OpenRouter OAuth exchange failed.");
  }

  if (!response.ok) {
    throw new OpenRouterOAuthError("OAUTH_EXCHANGE_FAILED", "OpenRouter OAuth exchange was rejected.");
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new OpenRouterOAuthError(
      "OAUTH_INVALID_RESPONSE",
      "OpenRouter OAuth returned an invalid response."
    );
  }

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof (body as Record<string, unknown>).key !== "string" ||
    !(body as Record<string, string>).key.trim()
  ) {
    throw new OpenRouterOAuthError(
      "OAUTH_INVALID_RESPONSE",
      "OpenRouter OAuth response did not include a key."
    );
  }

  return (body as Record<string, string>).key;
}
