import { NextRequest, NextResponse } from "next/server";
import {
  VOTE_RATE_LIMIT_MAX_REQUESTS,
  VOTE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import {
  ApiError,
  applyGuestCookie,
  checkRateLimit,
  createErrorResponse,
  getRateLimitKeyFromHeaders,
  logApiRequest,
  resolveRequestIdentity,
  saveBestVote,
  validateVoteIds,
} from "@/lib/server";

interface VoteRequest {
  taskId?: unknown;
  responseId?: unknown;
  voteType?: unknown;
}

interface VoteResponse {
  status: "success";
  voteId: string;
  taskId: string;
  responseId: string;
  voteType: "best";
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<VoteResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
    const rateLimitKey = `vote:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      VOTE_RATE_LIMIT_MAX_REQUESTS,
      VOTE_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("POST", "/api/vote", 429, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Too many vote requests. Please try again later.")
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logApiRequest("POST", "/api/vote", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.")
        ),
        { status: 400 }
      );
    }

    const { taskId, responseId, voteType } = body as VoteRequest;

    if (voteType !== undefined && voteType !== null && voteType !== "best") {
      throw new ApiError(400, "VALIDATION_ERROR", "Only voteType 'best' is supported in MVP.");
    }

    const ids = validateVoteIds(taskId, responseId);

    // Identity comes from the verified session / server-issued guest cookie,
    // never from the request body.
    const identity = await resolveRequestIdentity(request);

    const savedVote = await saveBestVote({
      taskId: ids.taskId,
      responseId: ids.responseId,
      userId: identity.userId,
      anonymousSessionId: identity.guestId,
    });

    logApiRequest("POST", "/api/vote", 200, Date.now() - startTime);

    const response = NextResponse.json(
      {
        status: "success" as const,
        voteId: savedVote.voteId,
        taskId: savedVote.taskId,
        responseId: savedVote.responseId,
        voteType: savedVote.voteType,
      },
      { status: 200 }
    );

    if (identity.kind === "guest") {
      applyGuestCookie(response, identity.guestId);
    }

    return response;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/vote error:", error);
    logApiRequest("POST", "/api/vote", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
