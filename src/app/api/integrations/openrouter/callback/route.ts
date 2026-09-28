import { NextRequest, NextResponse } from "next/server";
import { createAwsKmsDataKeyProviderFromEnv } from "@/lib/server/aws-kms-data-key-provider";
import {
  exchangeOpenRouterAuthorizationCode,
  oauthStateMatches,
  OpenRouterOAuthError,
} from "@/lib/server/openrouter-oauth";
import {
  getOpenRouterOAuthCookieSigningSecret,
  OPENROUTER_OAUTH_FLOW_COOKIE,
  OpenRouterOAuthSessionError,
  parseOpenRouterOAuthFlow,
} from "@/lib/server/openrouter-oauth-session";
import {
  OpenRouterCredentialError,
  persistOpenRouterOAuthCredential,
} from "@/lib/server/openrouter-credentials";
import { requireOpenRouterOAuthBetaAvailable } from "@/lib/server/openrouter-integration-security";
import {
  ApiError,
  getAuthenticatedUserId,
  logApiRequest,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

function profileRedirect(
  request: NextRequest,
  result: "connected" | "error",
  code?: string
): URL {
  const url = new URL("/profile", request.nextUrl.origin);
  url.searchParams.set("openrouter", result);
  if (code) url.searchParams.set("code", code);
  return url;
}

function clearFlowCookie(response: NextResponse): void {
  response.cookies.set(OPENROUTER_OAUTH_FLOW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: response.url.startsWith("https://"),
    path: "/api/integrations/openrouter",
    maxAge: 0,
  });
}

function safeCallbackCode(error: unknown): string {
  if (error instanceof ApiError) return error.errorCode;
  if (error instanceof OpenRouterOAuthError) return error.code;
  if (error instanceof OpenRouterOAuthSessionError) return error.code;
  if (error instanceof OpenRouterCredentialError) return error.code;
  return "OPENROUTER_CONNECT_FAILED";
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    requireOpenRouterOAuthBetaAvailable();

    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Sign in before connecting OpenRouter."
      );
    }

    const cookieValue = request.cookies.get(OPENROUTER_OAUTH_FLOW_COOKIE)?.value;
    if (!cookieValue) {
      throw new ApiError(
        400,
        "OAUTH_FLOW_INVALID",
        "OpenRouter OAuth flow cookie is missing."
      );
    }

    const flow = parseOpenRouterOAuthFlow({
      cookieValue,
      signingSecret: getOpenRouterOAuthCookieSigningSecret(),
      expectedUserId: userId,
    });

    const state = request.nextUrl.searchParams.get("state");
    if (!oauthStateMatches(flow.state, state)) {
      throw new ApiError(
        400,
        "OAUTH_STATE_MISMATCH",
        "OpenRouter OAuth state validation failed."
      );
    }

    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      throw new ApiError(
        400,
        "OAUTH_INVALID_INPUT",
        "OpenRouter authorization code is missing."
      );
    }

    const apiKey = await exchangeOpenRouterAuthorizationCode({
      code,
      codeVerifier: flow.codeVerifier,
    });

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database is unavailable.");
    }

    await persistOpenRouterOAuthCredential({
      supabase,
      userId,
      apiKey,
      dataKeyProvider: createAwsKmsDataKeyProviderFromEnv(),
    });

    const response = NextResponse.redirect(
      profileRedirect(request, "connected"),
      303
    );
    clearFlowCookie(response);

    logApiRequest(
      "GET",
      "/api/integrations/openrouter/callback",
      303,
      Date.now() - startTime
    );
    return response;
  } catch (error) {
    const code = safeCallbackCode(error);
    const response = NextResponse.redirect(
      profileRedirect(request, "error", code),
      303
    );
    clearFlowCookie(response);

    const statusCode =
      error instanceof ApiError
        ? error.statusCode
        : error instanceof OpenRouterOAuthError ||
            error instanceof OpenRouterOAuthSessionError ||
            error instanceof OpenRouterCredentialError
          ? 400
          : 500;

    logApiRequest(
      "GET",
      "/api/integrations/openrouter/callback",
      statusCode,
      Date.now() - startTime
    );
    return response;
  }
}
