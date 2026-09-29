import { NextRequest, NextResponse } from "next/server";
import {
  ApiError,
  checkRateLimit,
  createErrorResponse,
  getRateLimitKeyFromHeaders,
  loadCurrentOpenRouterPricing,
  loadModelCatalog,
  logApiRequest,
  resolveRequestIdentity,
} from "@/lib/server";
import {
  MODELS_RATE_LIMIT_MAX_REQUESTS,
  MODELS_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const rateLimitKey =
      `model-pricing:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      MODELS_RATE_LIMIT_MAX_REQUESTS,
      MODELS_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      return NextResponse.json(
        createErrorResponse(
          new ApiError(
            429,
            "RATE_LIMIT",
            "Too many requests. Please try again later."
          )
        ),
        { status: 429 }
      );
    }

    const identity = await resolveRequestIdentity(request);
    const catalog = await loadModelCatalog(identity);
    const pricing = await loadCurrentOpenRouterPricing(
      catalog.map((model) => model.modelKey)
    );

    const models = catalog.map((model) => {
      const price = pricing.get(model.modelKey);
      return {
        id: model.selectionId,
        inputPricePerMillion: price?.inputPricePerMillion ?? null,
        outputPricePerMillion: price?.outputPricePerMillion ?? null,
        currency: price?.currency ?? "USD",
        lastCheckedAt: price?.sourceCheckedAt ?? null,
        status: !price ? "unavailable" : price.stale ? "stale" : "current",
      };
    });

    logApiRequest(
      "GET",
      "/api/models/pricing",
      200,
      Date.now() - startTime
    );
    return NextResponse.json({
      status: "success",
      provider: "openrouter",
      models,
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest(
      "GET",
      "/api/models/pricing",
      statusCode,
      Date.now() - startTime
    );
    return NextResponse.json(createErrorResponse(error), {
      status: statusCode,
    });
  }
}
