import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkRateLimit,
  createErrorResponse,
  getRateLimitKeyFromHeaders,
  logApiRequest,
  resolveRequestIdentity,
} from "@/lib/server";
import { getLeaderboard } from "@/lib/server/leaderboard";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    await resolveRequestIdentity(request);

    const rateLimitKey = `leaderboard:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 60, 60_000);

    if (rateLimit.limited) {
      logApiRequest("GET", "/api/leaderboard", 429, Date.now() - startTime);
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

    const data = await getLeaderboard();

    logApiRequest("GET", "/api/leaderboard", 200, Date.now() - startTime);

    return NextResponse.json({ status: "success", data }, { status: 200 });
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/leaderboard", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
