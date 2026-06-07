import { NextRequest, NextResponse } from "next/server";
import {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
} from "@/lib/arena/constants";
import {
  validatePrompt,
  validateModelIds,
  createErrorResponse,
  logApiRequest,
  validateModelAllowlist,
  fetchMultipleResponses,
  getModelById,
  ApiError,
  savePromptArenaRun,
} from "@/lib/server";

interface CompareRequest {
  prompt: string;
  modelIds: string[];
  modeSlug?: string;
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

export async function POST(request: NextRequest): Promise<NextResponse<CompareResponse | ReturnType<typeof createErrorResponse>>> {
  const startTime = Date.now();

  try {
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

    if (modeSlug !== "prompt-arena") {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new ApiError(400, "INVALID_MODE", "Only Prompt Arena mode is supported.")
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

    try {
      validateModelAllowlist(modelIds);
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

    const cleanPrompt = prompt.trim();
    const responses = await fetchMultipleResponses(cleanPrompt, modelIds);

    const arenaResponses = modelIds.map((modelId, index) => {
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
    const savedRun = await savePromptArenaRun({
      prompt: cleanPrompt,
      modelIds,
      responses: arenaResponses,
    });

    const savedArenaResponses = arenaResponses.map((response) => ({
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
    console.error("POST /api/compare error:", error);
    logApiRequest("POST", "/api/compare", 500, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: 500 });
  }
}
