/**
 * GET /api/code-models
 * Returns code-capable models only (role_tags includes "coding").
 * Used by Code Arena frontend to populate model selector.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MODELS_RATE_LIMIT_MAX_REQUESTS,
  MODELS_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import {
  getAvailableCodeModels,
  createErrorResponse,
  logApiRequest,
  ApiError,
  checkRateLimit,
  getRateLimitKeyFromHeaders,
  resolveRequestIdentity,
} from "@/lib/server";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitKey = `code-models:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      MODELS_RATE_LIMIT_MAX_REQUESTS,
      MODELS_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("GET", "/api/code-models", 429, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Too many requests. Please try again later.")
        ),
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
              1
            ).toString(),
          },
        }
      );
    }

    const identity = await resolveRequestIdentity(request);
    const models = await getAvailableCodeModels(identity);

    logApiRequest("GET", "/api/code-models", 200, Date.now() - startTime);

    return NextResponse.json(
      { status: "success", models },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/code-models error:", error);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/code-models", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
