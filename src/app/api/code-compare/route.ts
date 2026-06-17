import { NextRequest, NextResponse } from "next/server";
import {
  CODE_PROMPT_MIN_LENGTH,
  CODE_PROMPT_MAX_LENGTH,
  CODE_MODEL_MIN_SELECT,
  CODE_MODEL_MAX_SELECT,
  CODE_COMPARE_RATE_LIMIT_MAX_REQUESTS,
  CODE_COMPARE_RATE_LIMIT_WINDOW_MS,
  MODE_SLUG_CODE_ARENA,
  CODE_ARENA_LANGUAGES,
} from "@/lib/arena/constants";
import {
  validatePrompt,
  validateModelIds,
  createErrorResponse,
  logApiRequest,
  resolveSelectedCodeModels,
  fetchMultipleResponses,
  ApiError,
  saveArenaRun,
  checkRateLimit,
  resolveRequestIdentity,
  applyGuestCookie,
} from "@/lib/server";

interface CodeCompareRequest {
  prompt?: unknown;
  modelIds?: unknown;
  language?: unknown;
  framework?: unknown | null;
  versions?: unknown;
}

interface CodeCompareResponse {
  status: "success" | "error";
  taskId?: string | null;
  language: string;
  framework: string | null;
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

type PersistableCodeResponse = CodeCompareResponse["responses"][number] & {
  modelKey: string;
  dbModelId: string | null;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

function buildCodeSystemPrompt(language: string, framework: string | null): string {
  const frameworkPart = framework ? ` с использованием ${framework}` : "";
  return [
    `Ты эксперт по программированию. Отвечай на задачи пользователя на языке ${language}${frameworkPart}.`,
    "Всегда предоставляй готовый к запуску код с пояснениями.",
    "Если применимо — используй лучшие практики для данного языка и стека.",
    "Код должен быть чистым, безопасным и хорошо структурированным.",
    "Отвечай на том же языке, на котором написан запрос пользователя.",
  ].join(" ");
}

function validateLanguage(language: unknown): { valid: true; value: string } | { valid: false; error: string } {
  if (typeof language !== "string" || !language.trim()) {
    return { valid: false, error: "Language is required." };
  }
  const clean = language.trim();
  const allowed = CODE_ARENA_LANGUAGES as readonly string[];
  if (!allowed.includes(clean)) {
    return { valid: false, error: `Language must be one of: ${allowed.join(", ")}.` };
  }
  return { valid: true, value: clean };
}

function validateFramework(framework: unknown): string | null {
  if (framework === null || framework === undefined || framework === "") return null;
  if (typeof framework !== "string") return null;
  const clean = framework.trim();
  return clean || null;
}

export async function POST(request: NextRequest): Promise<NextResponse<CodeCompareResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
    const identity = await resolveRequestIdentity(request);

    if (identity.kind === "none") {
      logApiRequest("POST", "/api/code-compare", 401, Date.now() - startTime);
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
    const rateLimitKey = `code-compare:${rateLimitSubKey}`;
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      CODE_COMPARE_RATE_LIMIT_MAX_REQUESTS,
      CODE_COMPARE_RATE_LIMIT_WINDOW_MS
    );

    if (rateLimit.limited) {
      logApiRequest("POST", "/api/code-compare", 429, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(429, "RATE_LIMIT", "Too many code compare requests. Please try again later.")
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
      logApiRequest("POST", "/api/code-compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "INVALID_JSON", "Request body must be valid JSON.")
        ),
        { status: 400 }
      );
    }

    const { prompt, modelIds, language, framework } = body as CodeCompareRequest;

    const languageValidation = validateLanguage(language);
    if (!languageValidation.valid) {
      logApiRequest("POST", "/api/code-compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(400, "VALIDATION_ERROR", languageValidation.error)),
        { status: 400 }
      );
    }
    const cleanLanguage = languageValidation.value;
    const cleanFramework = validateFramework(framework);

    const promptValidation = validatePrompt(prompt, CODE_PROMPT_MIN_LENGTH, CODE_PROMPT_MAX_LENGTH);
    if (!promptValidation.valid) {
      logApiRequest("POST", "/api/code-compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "VALIDATION_ERROR", promptValidation.error ?? "Invalid prompt")
        ),
        { status: 400 }
      );
    }
    const cleanPrompt = promptValidation.value ?? "";

    const modelIdValidation = validateModelIds(modelIds, CODE_MODEL_MIN_SELECT, CODE_MODEL_MAX_SELECT);
    if (!modelIdValidation.valid) {
      logApiRequest("POST", "/api/code-compare", 400, Date.now() - startTime);
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
      selectedModels = await resolveSelectedCodeModels(selectedModelIds, identity);
    } catch (error) {
      const statusCode = error instanceof ApiError ? error.statusCode : 403;
      console.warn("Code model resolution failed:", error);
      logApiRequest("POST", "/api/code-compare", statusCode, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          error instanceof ApiError
            ? error
            : new ApiError(403, "MODEL_NOT_ALLOWED", "One or more models are not allowed.")
        ),
        { status: statusCode }
      );
    }

    const systemPrompt = buildCodeSystemPrompt(cleanLanguage, cleanFramework);

    const responses = await fetchMultipleResponses(
      cleanPrompt,
      selectedModels.map((model) => model.modelKey),
      { systemPrompt }
    );

    const arenaResponses: PersistableCodeResponse[] = selectedModels.map((model, index) => {
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

    let savedRun: Awaited<ReturnType<typeof saveArenaRun>> = {
      taskId: null,
      responseIdsByModelId: {},
    };
    try {
      savedRun = await saveArenaRun({
        prompt: cleanPrompt,
        modeSlug: MODE_SLUG_CODE_ARENA,
        modelKeys: selectedModels.map((model) => model.modelKey),
        responses: arenaResponses,
        settings: {
          language: cleanLanguage,
          framework: cleanFramework,
          runTests: false,
        },
        owner: {
          userId: identity.userId,
          anonymousSessionId: identity.guestId,
        },
      });
    } catch (persistError) {
      console.error("Code Arena persistence failed (continuing):", persistError);
    }

    const savedArenaResponses = arenaResponses.map(
      ({ usage: _usage, modelKey: _modelKey, dbModelId: _dbModelId, ...response }) => ({
        ...response,
        id: savedRun.responseIdsByModelId[response.modelId] ?? response.id,
      })
    );

    logApiRequest("POST", "/api/code-compare", 200, Date.now() - startTime);

    const successBody: CodeCompareResponse = {
      status: hasAnySuccess ? "success" : "error",
      taskId: savedRun.taskId,
      language: cleanLanguage,
      framework: cleanFramework,
      responses: savedArenaResponses,
    };

    const successResponse = NextResponse.json(successBody, { status: 200 });

    if (identity.kind === "guest") {
      applyGuestCookie(successResponse, identity.guestId);
    }

    return successResponse;
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    console.error("POST /api/code-compare error:", error);
    logApiRequest("POST", "/api/code-compare", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
