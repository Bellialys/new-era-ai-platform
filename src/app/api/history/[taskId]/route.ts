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
  getHistoryTask,
  isUuid,
  logApiRequest,
  REQUEST_ID_HEADER,
  resolveRequestId,
  resolveRequestIdentity,
  type HistoryDetail,
  type HistoryIdentity,
} from "@/lib/server";

interface HistoryDetailResponse {
  status: "success";
  task: Omit<HistoryDetail, "responses">;
  responses: HistoryDetail["responses"];
  requestId: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
): Promise<NextResponse<HistoryDetailResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);
  const path = "/api/history/[taskId]";

  try {
    const identity = await resolveRequestIdentity(request);

    if (identity.kind === "none") {
      logApiRequest("GET", path, 401, Date.now() - startTime, requestId);
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
      `history-detail:${rateLimitSubKey}`,
      HISTORY_RATE_LIMIT_MAX_REQUESTS,
      HISTORY_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("GET", path, 429, Date.now() - startTime, requestId);
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

    const { taskId } = await params;
    if (!isUuid(taskId)) {
      logApiRequest("GET", path, 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", "taskId must be a valid UUID."),
          requestId
        ),
        { status: 400, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const historyIdentity: HistoryIdentity =
      identity.kind === "user"
        ? { userId: identity.userId, anonymousSessionId: null }
        : { userId: null, anonymousSessionId: identity.guestId };

    const detail = await getHistoryTask({ identity: historyIdentity, taskId });

    if (!detail) {
      // Do not distinguish "does not exist" from "not yours" — avoid leaking existence.
      logApiRequest("GET", path, 404, Date.now() - startTime, requestId);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(404, "TASK_NOT_FOUND", "Comparison not found."),
          requestId
        ),
        { status: 404, headers: { [REQUEST_ID_HEADER]: requestId } }
      );
    }

    const { responses, ...task } = detail;

    logApiRequest("GET", path, 200, Date.now() - startTime, requestId);

    const response = NextResponse.json<HistoryDetailResponse>(
      { status: "success", task, responses, requestId },
      { status: 200, headers: { [REQUEST_ID_HEADER]: requestId } }
    );

    if (identity.kind === "guest") {
      applyGuestCookie(response, identity.guestId);
    }

    return response;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("GET /api/history/[taskId] error:", error);
    logApiRequest("GET", path, statusCode, Date.now() - startTime, requestId);
    return NextResponse.json(createErrorResponse(error, requestId), {
      status: statusCode,
      headers: { [REQUEST_ID_HEADER]: requestId },
    });
  }
}
