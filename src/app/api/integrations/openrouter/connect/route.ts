import { NextRequest, NextResponse } from "next/server";
import {
  buildOpenRouterAuthorizationUrl,
  createOpenRouterPkceSession,
} from "@/lib/server/openrouter-oauth";
import {
  getOpenRouterOAuthCookieSigningSecret,
  OPENROUTER_OAUTH_FLOW_COOKIE,
  OPENROUTER_OAUTH_FLOW_TTL_SECONDS,
  serializeOpenRouterOAuthFlow,
} from "@/lib/server/openrouter-oauth-session";
import {
  getOpenRouterIntegrationStatus,
  OpenRouterCredentialError,
} from "@/lib/server/openrouter-credentials";
import {
  requireOpenRouterOAuthBetaAvailable,
  requireSameOriginMutation,
} from "@/lib/server/openrouter-integration-security";
import {
  ApiError,
  checkRateLimit,
  createErrorResponse,
  getAuthenticatedUserId,
  logApiRequest,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

const CONNECT_LIMIT = 6;
const CONNECT_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    requireSameOriginMutation(request);
    requireOpenRouterOAuthBetaAvailable();

    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Sign in before connecting OpenRouter."
      );
    }

    const limit = await checkRateLimit(
      `openrouter-oauth-connect:${userId}`,
      CONNECT_LIMIT,
      CONNECT_WINDOW_MS
    );
    if (limit.limited) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Too many OpenRouter connection attempts. Try again later."
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database is unavailable.");
    }

    const current = await getOpenRouterIntegrationStatus(supabase, userId);
    if (current.connected) {
      throw new ApiError(
        409,
        "OPENROUTER_ALREADY_CONNECTED",
        "OpenRouter is already connected."
      );
    }

    const session = createOpenRouterPkceSession();
    const callbackUrl = new URL(
      "/api/integrations/openrouter/callback",
      request.nextUrl.origin
    );
    callbackUrl.searchParams.set("state", session.state);

    const authorizationUrl = buildOpenRouterAuthorizationUrl({
      callbackUrl: callbackUrl.toString(),
      codeChallenge: session.codeChallenge,
      state: session.state,
    });

    const cookieValue = serializeOpenRouterOAuthFlow({
      userId,
      state: session.state,
      codeVerifier: session.codeVerifier,
      signingSecret: getOpenRouterOAuthCookieSigningSecret(),
    });

    const response = NextResponse.json({
      status: "success",
      authorizationUrl,
    });
    response.cookies.set(OPENROUTER_OAUTH_FLOW_COOKIE, cookieValue, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/api/integrations/openrouter",
      maxAge: OPENROUTER_OAUTH_FLOW_TTL_SECONDS,
    });

    logApiRequest(
      "POST",
      "/api/integrations/openrouter/connect",
      200,
      Date.now() - startTime
    );
    return response;
  } catch (error) {
    let safeError: unknown = error;
    if (error instanceof OpenRouterCredentialError) {
      safeError = new ApiError(500, error.code, error.message);
    }

    const statusCode = safeError instanceof ApiError ? safeError.statusCode : 500;
    logApiRequest(
      "POST",
      "/api/integrations/openrouter/connect",
      statusCode,
      Date.now() - startTime
    );
    return NextResponse.json(createErrorResponse(safeError), {
      status: statusCode,
    });
  }
}
