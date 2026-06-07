/**
 * GET /api/models
 * Returns list of available models that can be used for comparison
 */

import { NextResponse } from "next/server";
import {
  getAvailableModels,
  createErrorResponse,
  logApiRequest,
  ApiError,
} from "@/lib/server";

export async function GET() {
  const startTime = Date.now();

  try {
    // Get available models (from Supabase when configured, hardcoded otherwise)
    const models = await getAvailableModels();

    // Log request
    logApiRequest("GET", "/api/models", 200, Date.now() - startTime);

    // Return response
    return NextResponse.json(
      {
        status: "success",
        models,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/models error:", error);
    const statusCode = error instanceof ApiError ? error.statusCode : 500;

    // Log request
    logApiRequest("GET", "/api/models", statusCode, Date.now() - startTime);

    // Return error response
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(errorResponse, { status: statusCode });
  }
}
