import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  createErrorResponse,
  logApiRequest,
  saveBestVote,
  validateVoteIds,
} from "@/lib/server";

interface VoteRequest {
  taskId?: unknown;
  responseId?: unknown;
  voteType?: unknown;
  userId?: unknown;
  anonymousSessionId?: unknown;
}

interface VoteResponse {
  status: "success";
  voteId: string;
  taskId: string;
  responseId: string;
  voteType: "best";
}

function normalizeOptionalString(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${fieldName} must be a string.`);
  }

  return value;
}

export async function POST(
  request: NextRequest
): Promise<NextResponse<VoteResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
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

    const { taskId, responseId, voteType, userId, anonymousSessionId } = body as VoteRequest;

    if (voteType !== undefined && voteType !== null && voteType !== "best") {
      throw new ApiError(400, "VALIDATION_ERROR", "Only voteType 'best' is supported in MVP.");
    }

    const ids = validateVoteIds(taskId, responseId);
    const savedVote = await saveBestVote({
      taskId: ids.taskId,
      responseId: ids.responseId,
      userId: normalizeOptionalString(userId, "userId"),
      anonymousSessionId: normalizeOptionalString(anonymousSessionId, "anonymousSessionId"),
    });

    logApiRequest("POST", "/api/vote", 200, Date.now() - startTime);

    return NextResponse.json(
      {
        status: "success",
        voteId: savedVote.voteId,
        taskId: savedVote.taskId,
        responseId: savedVote.responseId,
        voteType: savedVote.voteType,
      },
      { status: 200 }
    );
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/vote error:", error);
    logApiRequest("POST", "/api/vote", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
