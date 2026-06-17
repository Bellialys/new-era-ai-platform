/**
 * GET /api/models
 * Returns the list of available models that can be used for comparison.
 *
 * Rate-limited by IP to prevent enumeration / scraping. Authenticated users
 * get the same IP-based key here because model listing is public information —
 * no per-user quota is needed.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  MODELS_RATE_LIMIT_MAX_REQUESTS,
  MODELS_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import {
  getAvailableModels,
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
    const rateLimitKey = `models:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      MODELS_RATE_LIMIT_MAX_REQUESTS,
      MODELS_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("GET", "/api/models", 429, Date.now() - startTime);
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

    // Resolve identity to filter models by access level.
    // /api/models does NOT require auth — guests get anonymous models only.
    const identity = await resolveRequestIdentity(request);
    const models = await getAvailableModels(identity);

    logApiRequest("GET", "/api/models", 200, Date.now() - startTime);

    return NextResponse.json(
      { status: "success", models },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/models error:", error);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/models", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
