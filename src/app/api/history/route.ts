import { NextRequest, NextResponse } from "next/server";
import {
  HISTORY_RATE_LIMIT_MAX_REQUESTS,
  HISTORY_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import {
  ApiError,
  applyGuestCookie,
  checkRateLimit,
  createErrorResponse,
  listHistory,
  logApiRequest,
  REQUEST_ID_HEADER,
  resolveRequestId,
  resolveRequestIdentity,
  type HistoryIdentity,
  type HistoryListItem,
} from "@/lib/server";

interface HistoryListResponse {
  status: "success";
  items: HistoryListItem[];
  nextCursor: string | null;
  requestId: string;
}

function parseLimit(raw: string | null): number | undefined {
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(
  request: NextRequest
): Promise<NextResponse<HistoryListResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    // Resolve identity BEFORE rate limiting so each caller has their own quota.
    const identity = await resolveRequestIdentity(request);

    if (identity.kind === "none") {
      logApiRequest("GET", "/api/history", 401, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            401,
            "AUTH_REQUIRED",
            "Please sign in or continue as a guest to view history."
          ),
          requestId
        ),
        { status: 401, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const rateLimitSubKey =
      identity.kind === "user" ? `user:${identity.userId}` : `guest:${identity.guestId}`;
    const rateLimit = await checkRateLimit(
      `history:${rateLimitSubKey}`,
      HISTORY_RATE_LIMIT_MAX_REQUESTS,
      HISTORY_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("GET", "/api/history", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Too many history requests. Please try again later."),
          requestId
        ),
        {
          status: 429,
          headers: {
            [REQUEST_ID_HEADER]: requestId,
            "Retry-After": Math.max(
              Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
              1
            ).toString(),
          },
        }
      );
    }

    const params = request.nextUrl.searchParams;
    const historyIdentity: HistoryIdentity =
      identity.kind === "user"
        ? { userId: identity.userId, anonymousSessionId: null }
        : { userId: null, anonymousSessionId: identity.guestId };

    const result = await listHistory({
      identity: historyIdentity,
      limit: parseLimit(params.get("limit")),
      cursor: params.get("cursor"),
      modeSlug: params.get("mode"),
    });

    logApiRequest("GET", "/api/history", 200, Date.now() - startTime, requestId);

    const response = NextResponse.json<HistoryListResponse>(
      {
        status: "success",
        items: result.items,
        nextCursor: result.nextCursor,
        requestId,
      },
      { status: 200, headers: { [REQUEST_ID_HEADER]: requestId } }
    );

    if (identity.kind === "guest") {
      applyGuestCookie(response, identity.guestId);
    }

    return response;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("GET /api/history error:", error);
    logApiRequest("GET", "/api/history", statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), {
      status: statusCode,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }
}
