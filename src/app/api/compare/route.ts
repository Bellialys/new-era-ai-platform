/**
 * POST /api/compare
 * Compares a prompt across multiple AI models
 * 
 * Request body:
 * {
 *   "prompt": string (3-8000 chars),
 *   "modelIds": string[] (2-3 items)
 * }
 * 
 * Response:
 * {
 *   "status": "success" | "error",
 *   "responses": { modelId: string, answerText: string }[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { ArenaApiResponse } from "@/types/arena";
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
} from "@/lib/server";

interface CompareRequest {
  prompt: string;
  modelIds: string[];
}

export async function POST(request: NextRequest): Promise<NextResponse<ArenaApiResponse>> {
  const startTime = Date.now();

  try {
    // Parse request body
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

    // Validate prompt
    const promptValidation = validatePrompt(
      prompt,
      PROMPT_MIN_LENGTH,
      PROMPT_MAX_LENGTH
    );
    if (!promptValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new Error(promptValidation.error)),
        { status: 400 }
      );
    }

    // Validate model IDs
    const modelIdValidation = validateModelIds(
      modelIds,
      MODEL_MIN_SELECT,
      MODEL_MAX_SELECT
    );
    if (!modelIdValidation.valid) {
      logApiRequest("POST", "/api/compare", 400, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new Error(modelIdValidation.error)),
        { status: 400 }
      );
    }

    // Validate model allowlist
    try {
      validateModelAllowlist(modelIds);
    } catch (error) {
      console.warn("Model allowlist validation failed:", error);
      logApiRequest("POST", "/api/compare", 403, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(
          new Error("One or more models are not allowed")
        ),
        { status: 403 }
      );
    }

    // Fetch responses from all models in parallel
    const responses = await fetchMultipleResponses(prompt, modelIds);

    // Map responses to the expected format
    const arenaResponses = modelIds.map((modelId, index) => {
      const response = responses[index];
      if (typeof response === "string") {
        return {
          modelId,
          answerText: response,
        };
      } else {
        return {
          modelId,
          answerText: response.error || "Failed to get response",
        };
      }
    });

    // Check if all responses failed
    const hasAnySuccess = arenaResponses.some(
      (r) => !r.answerText.startsWith("Failed") && !r.answerText.includes("error")
    );

    logApiRequest("POST", "/api/compare", 200, Date.now() - startTime);

    // Return response
    const result: ArenaApiResponse = {
      status: hasAnySuccess ? "success" : "error",
      responses: arenaResponses,
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("POST /api/compare error:", error);

    logApiRequest("POST", "/api/compare", 500, Date.now() - startTime);

    // Return generic error response
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
