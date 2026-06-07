import { NextRequest, NextResponse } from "next/server";
import {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
  COMPARE_RATE_LIMIT_MAX_REQUESTS,
  COMPARE_RATE_LIMIT_WINDOW_MS,
  MODE_SLUG_PROMPT_ARENA,
} from "@/lib/arena/constants";
import {
  validatePrompt,
  validateModelIds,
  validateModeSlug,
  createErrorResponse,
  logApiRequest,
  validateModelAllowlist,
  fetchMultipleResponses,
  getModelById,
  ApiError,
  savePromptArenaRun,
  checkRateLimit,
  getRateLimitKeyFromHeaders,
} from "@/lib/server";

interface CompareRequest {
  prompt?: unknown;
  modelIds?: unknown;
  modeSlug?: unknown;
}

interface CompareResponse {
  status: "success" | "error";
  taskId?: string | null;
  responses: {
    id: string;
    modelId: string;
    modelName: string;
    status: "success" | "error";
    answerText: string | null;
    latencyMs?: number;
    errorCode?: string;
    errorMessage?: string;
  }[];
}

type PersistableCompareResponse = CompareResponse["responses"][number] & {
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

export async function POST(request: NextRequest): Promise<NextResponse<CompareResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
    const rateLimitKey = `compare:${getRateLimitKeyFromHeaders(request.headers)}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      COMPARE_RATE_LIMIT_MAX_REQUESTS,
      COMPARE_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("POST", "/api/compare", 429, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Too many compare requests. Please try again later.")
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
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.")
        ),
        { status: 400 }
      );
    }

    const { prompt, modelIds, modeSlug } = body as CompareRequest;

    const modeValidation = validateModeSlug(modeSlug, MODE_SLUG_PROMPT_ARENA);
    if (!modeValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "INVALID_MODE", modeValidation.error ?? "Invalid mode")
        ),
        { status: 400 }
      );
    }

    const promptValidation = validatePrompt(prompt, PROMPT_MIN_LENGTH, PROMPT_MAX_LENGTH);
    if (!promptValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", promptValidation.error ?? "Invalid prompt")
        ),
        { status: 400 }
      );
    }
    const cleanPrompt = promptValidation.value ?? "";

    const modelIdValidation = validateModelIds(modelIds, MODEL_MIN_SELECT, MODEL_MAX_SELECT);
    if (!modelIdValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", modelIdValidation.error ?? "Invalid models")
        ),
        { status: 400 }
      );
    }
    const selectedModelIds = modelIdValidation.value ?? [];

    try {
      validateModelAllowlist(selectedModelIds);
    } catch (error) {
      console.warn("Model allowlist validation failed:", error);
      logApiRequest("POST", "/api/compare", 403, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(403, "MODEL_NOT_ALLOWED", "One or more models are not allowed.")
        ),
        { status: 403 }
      );
    }

    const responses = await fetchMultipleResponses(cleanPrompt, selectedModelIds);

    const arenaResponses: PersistableCompareResponse[] = selectedModelIds.map((modelId, index) => {
      const result = responses[index];
      const model = getModelById(modelId);
      const modelName = model?.name ?? modelId;

      if (result.success) {
        return {
          id: crypto.randomUUID(),
          modelId,
          modelName,
          status: "success" as const,
          answerText: result.text,
          latencyMs: result.latencyMs,
          usage: result.usage,
        };
      } else {
        return {
          id: crypto.randomUUID(),
          modelId,
          modelName,
          status: "error" as const,
          answerText: null,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
        };
      }
    });

    const hasAnySuccess = arenaResponses.some((r) => r.status === "success");

    // Persistence is best-effort: a database failure must not discard model
    // answers the user already paid for. Fall back to the in-memory ids.
    let savedRun: Awaited<ReturnType<typeof savePromptArenaRun>> = {
      taskId: null,
      responseIdsByModelId: {},
    };
    try {
      savedRun = await savePromptArenaRun({
        prompt: cleanPrompt,
        modelIds: selectedModelIds,
        responses: arenaResponses,
      });
    } catch (persistError) {
      console.error("Prompt Arena persistence failed (continuing):", persistError);
    }

    const savedArenaResponses = arenaResponses.map(({ usage: _usage, ...response }) => ({
      ...response,
      id: savedRun.responseIdsByModelId[response.modelId] ?? response.id,
    }));

    logApiRequest("POST", "/api/compare", 200, Date.now() - startTime);

    return NextResponse.json(
      {
        status: hasAnySuccess ? "success" : "error",
        taskId: savedRun.taskId,
        responses: savedArenaResponses,
      },
      { status: 200 }
    );
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/compare error:", error);
    logApiRequest("POST", "/api/compare", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
