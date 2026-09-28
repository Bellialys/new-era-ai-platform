import { NextRequest, NextResponse } from "next/server";
import {
  disconnectOpenRouterCredential,
  getOpenRouterIntegrationStatus,
  OpenRouterCredentialError,
} from "@/lib/server/openrouter-credentials";
import { isOpenRouterOAuthBetaAvailable } from "@/lib/server/openrouter-integration-config";
import { requireSameOriginMutation } from "@/lib/server/openrouter-integration-security";
import {
  ApiError,
  checkRateLimit,
  createErrorResponse,
  getAuthenticatedUserId,
  logApiRequest,
} from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

const MUTATION_LIMIT = 12;
const MUTATION_WINDOW_MS = 10 * 60 * 1000;

function mapCredentialError(error: unknown): unknown {
  if (error instanceof OpenRouterCredentialError) {
    return new ApiError(500, error.code, error.message);
  }
  return error;
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Sign in to view OpenRouter connection status."
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database is unavailable.");
    }

    const integration = await getOpenRouterIntegrationStatus(supabase, userId);

    logApiRequest(
      "GET",
      "/api/integrations/openrouter",
      200,
      Date.now() - startTime
    );
    return NextResponse.json({
      status: "success",
      enabled: isOpenRouterOAuthBetaAvailable(),
      integration: {
        connected: integration.connected,
        safeFingerprint: integration.safeFingerprint,
        lastVerifiedAt: integration.lastVerifiedAt,
        fundingSource: integration.fundingSource,
      },
    });
  } catch (error) {
    const safeError = mapCredentialError(error);
    const statusCode = safeError instanceof ApiError ? safeError.statusCode : 500;
    logApiRequest(
      "GET",
      "/api/integrations/openrouter",
      statusCode,
      Date.now() - startTime
    );
    return NextResponse.json(createErrorResponse(safeError), {
      status: statusCode,
    });
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();

  try {
    requireSameOriginMutation(request);

    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      throw new ApiError(
        401,
        "AUTH_REQUIRED",
        "Sign in before disconnecting OpenRouter."
      );
    }

    const limit = await checkRateLimit(
      `openrouter-oauth-mutation:${userId}`,
      MUTATION_LIMIT,
      MUTATION_WINDOW_MS
    );
    if (limit.limited) {
      const rateLimitError = new ApiError(
        429,
        "RATE_LIMITED",
        "Too many OpenRouter account changes. Try again later."
      );
      logApiRequest(
        "DELETE",
        "/api/integrations/openrouter",
        429,
        Date.now() - startTime
      );
      return NextResponse.json(createErrorResponse(rateLimitError), {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))
          ),
        },
      });
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database is unavailable.");
    }

    await disconnectOpenRouterCredential({ supabase, userId });

    logApiRequest(
      "DELETE",
      "/api/integrations/openrouter",
      200,
      Date.now() - startTime
    );
    return NextResponse.json({
      status: "success",
      integration: {
        connected: false,
        fundingSource: "platform",
      },
    });
  } catch (error) {
    const safeError = mapCredentialError(error);
    const statusCode = safeError instanceof ApiError ? safeError.statusCode : 500;
    logApiRequest(
      "DELETE",
      "/api/integrations/openrouter",
      statusCode,
      Date.now() - startTime
    );
    return NextResponse.json(createErrorResponse(safeError), {
      status: statusCode,
    });
  }
}
