import { createHmac, timingSafeEqual } from "node:crypto";

export const OPENROUTER_OAUTH_FLOW_COOKIE = "na_openrouter_oauth";
export const OPENROUTER_OAUTH_FLOW_TTL_SECONDS = 10 * 60;

const COOKIE_VERSION = 1;
const MIN_SIGNING_SECRET_BYTES = 32;
const STATE_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface OpenRouterOAuthFlowPayload {
  v: 1;
  userId: string;
  state: string;
  codeVerifier: string;
  issuedAt: number;
}

export class OpenRouterOAuthSessionError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_FLOW_CONFIG_INVALID"
      | "OAUTH_FLOW_INVALID"
      | "OAUTH_FLOW_EXPIRED",
    message: string
  ) {
    super(message);
    this.name = "OpenRouterOAuthSessionError";
  }
}

function signingSecretBytes(secret: string): Buffer {
  const bytes = Buffer.from(secret, "utf8");
  if (bytes.byteLength < MIN_SIGNING_SECRET_BYTES) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_CONFIG_INVALID",
      "OpenRouter OAuth cookie signing secret must be at least 32 bytes."
    );
  }
  return bytes;
}

export function getOpenRouterOAuthCookieSigningSecret(
  env: NodeJS.ProcessEnv = process.env
): string {
  const secret = env.OPENROUTER_OAUTH_COOKIE_SECRET?.trim();
  if (!secret) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_CONFIG_INVALID",
      "OPENROUTER_OAUTH_COOKIE_SECRET is required."
    );
  }
  signingSecretBytes(secret);
  return secret;
}

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac("sha256", signingSecretBytes(secret))
    .update(encodedPayload, "utf8")
    .digest();
}

function isPayload(value: unknown): value is OpenRouterOAuthFlowPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.v === COOKIE_VERSION &&
    typeof payload.userId === "string" &&
    UUID_PATTERN.test(payload.userId) &&
    typeof payload.state === "string" &&
    STATE_PATTERN.test(payload.state) &&
    typeof payload.codeVerifier === "string" &&
    VERIFIER_PATTERN.test(payload.codeVerifier) &&
    typeof payload.issuedAt === "number" &&
    Number.isSafeInteger(payload.issuedAt) &&
    payload.issuedAt > 0
  );
}

export function serializeOpenRouterOAuthFlow(input: {
  userId: string;
  state: string;
  codeVerifier: string;
  signingSecret: string;
  nowMs?: number;
}): string {
  const issuedAt = input.nowMs ?? Date.now();
  const payload: OpenRouterOAuthFlowPayload = {
    v: COOKIE_VERSION,
    userId: input.userId,
    state: input.state,
    codeVerifier: input.codeVerifier,
    issuedAt,
  };

  if (!isPayload(payload)) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow payload is invalid."
    );
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = sign(encodedPayload, input.signingSecret).toString("base64url");
  return `${encodedPayload}.${signature}`;
}

export function parseOpenRouterOAuthFlow(input: {
  cookieValue: string;
  signingSecret: string;
  expectedUserId: string;
  nowMs?: number;
}): {
  userId: string;
  state: string;
  codeVerifier: string;
  issuedAt: number;
} {
  const parts = input.cookieValue.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow cookie is invalid."
    );
  }

  const [encodedPayload, encodedSignature] = parts;
  let receivedSignature: Buffer;
  try {
    receivedSignature = Buffer.from(encodedSignature, "base64url");
  } catch {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow signature is invalid."
    );
  }

  const expectedSignature = sign(encodedPayload, input.signingSecret);
  if (
    receivedSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow signature is invalid."
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow payload is invalid."
    );
  }

  if (!isPayload(parsed) || parsed.userId !== input.expectedUserId) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_INVALID",
      "OpenRouter OAuth flow does not match the current user."
    );
  }

  const nowMs = input.nowMs ?? Date.now();
  if (
    parsed.issuedAt > nowMs ||
    nowMs - parsed.issuedAt > OPENROUTER_OAUTH_FLOW_TTL_SECONDS * 1000
  ) {
    throw new OpenRouterOAuthSessionError(
      "OAUTH_FLOW_EXPIRED",
      "OpenRouter OAuth flow expired."
    );
  }

  return parsed;
}
