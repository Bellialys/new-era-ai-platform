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
  resolveSelectedModels,
  fetchMultipleResponses,
  ApiError,
  savePromptArenaRun,
  checkRateLimit,
  resolveRequestIdentity,
  applyGuestCookie,
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
  modelKey: string;
  dbModelId: string | null;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

export async function POST(request: NextRequest): Promise<NextResponse<CompareResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
    // Resolve identity BEFORE rate limiting so that authenticated users get
    // their own quota instead of sharing it with other users on the same IP
    // (corporate NAT, shared VPN, etc.). Guests are keyed by their httpOnly
    // session cookie set by POST /api/guest.
    const identity = await resolveRequestIdentity(request);

    // Require an explicit user or guest session (created via POST /api/guest).
    // Completely unidentified callers get 401 AUTH_REQUIRED.
    if (identity.kind === "none") {
      logApiRequest("POST", "/api/compare", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(401, "AUTH_REQUIRED", "Please sign in or continue as a guest before comparing models.")
        ),
        { status: 401 }
      );
    }

    const rateLimitSubKey =
      identity.kind === "user"
        ? `user:${identity.userId}`
        : `guest:${identity.guestId}`;
    const rateLimitKey = `compare:${rateLimitSubKey}`;
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

    let selectedModels;
    try {
      selectedModels = await resolveSelectedModels(selectedModelIds, identity);
    } catch (error) {
      const statusCode = error instanceof ApiError ? error.statusCode : 403;
      console.warn("Model resolution failed:", error);
      logApiRequest("POST", "/api/compare", statusCode, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          error instanceof ApiError
            ? error
            : new ApiError(403, "MODEL_NOT_ALLOWED", "One or more models are not allowed.")
        ),
        { status: statusCode }
      );
    }

    const responses = await fetchMultipleResponses(
      cleanPrompt,
      selectedModels.map((model) => model.modelKey)
    );

    const arenaResponses: PersistableCompareResponse[] = selectedModels.map((model, index) => {
      const result = responses[index];

      if (result.success) {
        return {
          id: crypto.randomUUID(),
          modelId: model.selectionId,
          modelName: model.name,
          status: "success" as const,
          answerText: result.text,
          latencyMs: result.latencyMs,
          modelKey: model.modelKey,
          dbModelId: model.modelId,
          usage: result.usage,
        };
      } else {
        return {
          id: crypto.randomUUID(),
          modelId: model.selectionId,
          modelName: model.name,
          status: "error" as const,
          answerText: null,
          errorCode: result.errorCode,
          errorMessage: result.errorMessage,
          modelKey: model.modelKey,
          dbModelId: model.modelId,
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
        modelKeys: selectedModels.map((model) => model.modelKey),
        responses: arenaResponses,
        owner: {
          userId: identity.userId,
          anonymousSessionId: identity.guestId,
        },
      });
    } catch (persistError) {
      console.error("Prompt Arena persistence failed (continuing):", persistError);
    }

    const savedArenaResponses = arenaResponses.map(
      ({ usage: _usage, modelKey: _modelKey, dbModelId: _dbModelId, ...response }) => ({
        ...response,
        id: savedRun.responseIdsByModelId[response.modelId] ?? response.id,
      })
    );

    logApiRequest("POST", "/api/compare", 200, Date.now() - startTime);

    const successBody: CompareResponse = {
      status: hasAnySuccess ? "success" : "error",
      taskId: savedRun.taskId,
      responses: savedArenaResponses,
    };

    const successResponse = NextResponse.json(successBody, { status: 200 });

    if (identity.kind === "guest") {
      applyGuestCookie(successResponse, identity.guestId);
    }

    return successResponse;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/compare error:", error);
    logApiRequest("POST", "/api/compare", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
