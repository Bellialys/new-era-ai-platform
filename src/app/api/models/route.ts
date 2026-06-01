/**
 * GET /api/models
 * Returns list of available models that can be used for comparison
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAvailableModels,
  createErrorResponse,
  logApiRequest,
} from "@/lib/server";

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get available models
    const models = getAvailableModels();

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

    // Log request
    logApiRequest("GET", "/api/models", 500, Date.now() - startTime);

    // Return error response
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(errorResponse, { status: 500 });
  }
}
