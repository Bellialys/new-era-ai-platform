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
} from "@/lib/server";

interface CompareRequest {
  prompt: string;
  modelIds: string[];
  modeSlug?: string;
}

interface CompareResponse {
  status: "success" | "error";
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
        createErrorResponse(new Error("Invalid JSON body")),
        { status: 400 }
      );
    }

    const { prompt, modelIds } = body as CompareRequest;

    const promptValidation = validatePrompt(prompt, PROMPT_MIN_LENGTH, PROMPT_MAX_LENGTH);
    if (!promptValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new Error(promptValidation.error)),
        { status: 400 }
      );
    }

    const modelIdValidation = validateModelIds(modelIds, MODEL_MIN_SELECT, MODEL_MAX_SELECT);
    if (!modelIdValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new Error(modelIdValidation.error)),
        { status: 400 }
      );
    }

    try {
      validateModelAllowlist(modelIds);
    } catch (error) {
      console.warn("Model allowlist validation failed:", error);
      logApiRequest("POST", "/api/compare", 403, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new Error("One or more models are not allowed")),
        { status: 403 }
      );
    }

    const responses = await fetchMultipleResponses(prompt, modelIds);

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

    logApiRequest("POST", "/api/compare", 200, Date.now() - startTime);

    return NextResponse.json(
      {
        status: hasAnySuccess ? "success" : "error",
        responses: arenaResponses,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("POST /api/compare error:", error);
    logApiRequest("POST", "/api/compare", 500, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: 500 });
  }
}
