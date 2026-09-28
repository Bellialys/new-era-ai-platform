import type { NextRequest } from "next/server";
import { ApiError } from "./utils";
import {
  isOpenRouterOAuthBetaAvailable,
  type OpenRouterIntegrationEnvironment,
} from "./openrouter-integration-config";

export function requireSameOriginMutation(request: NextRequest): void {
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new ApiError(403, "CSRF_REJECTED", "Request origin is required.");
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    throw new ApiError(403, "CSRF_REJECTED", "Request origin is invalid.");
  }

  if (requestOrigin !== request.nextUrl.origin) {
    throw new ApiError(403, "CSRF_REJECTED", "Cross-origin request rejected.");
  }
}

export function requireOpenRouterOAuthBetaAvailable(
  env: OpenRouterIntegrationEnvironment = process.env
): void {
  if (!isOpenRouterOAuthBetaAvailable(env)) {
    throw new ApiError(
      503,
      "OPENROUTER_OAUTH_DISABLED",
      "OpenRouter connection beta is not enabled."
    );
  }
}
