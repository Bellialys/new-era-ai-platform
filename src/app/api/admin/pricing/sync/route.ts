import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkAdminMutationRateLimit,
  createErrorResponse,
  logApiRequest,
  requireAdmin,
  syncCuratedOpenRouterPricing,
} from "@/lib/server";
import { resolveRequestId } from "@/lib/server/utils";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = resolveRequestId(request);

  try {
    const { userId } = await requireAdmin();
    const rateLimit = await checkAdminMutationRateLimit(
      userId,
      "pricing.sync"
    );

    if (rateLimit.limited) {
      throw new ApiError(
        429,
        "RATE_LIMIT",
        "Too many pricing sync requests."
      );
    }

    const result = await syncCuratedOpenRouterPricing();

    logApiRequest(
      "POST",
      "/api/admin/pricing/sync",
      200,
      Date.now() - startTime,
      requestId
    );
    return NextResponse.json({ status: "success", ...result });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest(
      "POST",
      "/api/admin/pricing/sync",
      statusCode,
      Date.now() - startTime,
      requestId
    );
    return NextResponse.json(createErrorResponse(error, requestId), {
      status: statusCode,
    });
  }
}
