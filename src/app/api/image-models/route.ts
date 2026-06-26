import { NextRequest, NextResponse } from "next/server";
import { IMAGE_MODELS } from "@/lib/arena/image-models";
import {
  logApiRequest,
  resolveRequestIdentity,
  checkRateLimit,
  getRateLimitKeyFromHeaders,
} from "@/lib/server";
import {
  MODELS_RATE_LIMIT_MAX_REQUESTS,
  MODELS_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  const rateLimitKey = `image-models:${getRateLimitKeyFromHeaders(request.headers)}`;
  const rateLimit = await checkRateLimit(
    rateLimitKey,
    MODELS_RATE_LIMIT_MAX_REQUESTS,
    MODELS_RATE_LIMIT_WINDOW_MS
  );

  if (rateLimit.limited) {
    logApiRequest("GET", "/api/image-models", 429, Date.now() - startTime);
    return NextResponse.json({ error: "RATE_LIMIT", message: "Too many requests." }, { status: 429 });
  }

  const identity = await resolveRequestIdentity(request);
  const models =
    identity.kind === "user"
      ? IMAGE_MODELS
      : IMAGE_MODELS.filter((m) => m.accessLevel === "anonymous");

  logApiRequest("GET", "/api/image-models", 200, Date.now() - startTime);
  return NextResponse.json({ status: "success", models }, { status: 200 });
}
