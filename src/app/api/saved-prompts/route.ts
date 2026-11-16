import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  ApiError, checkRateLimit, createErrorResponse, getAuthenticatedUserId,
  getSupabaseServerClient, logApiRequest,
} from "@/lib/server";
import { requireSameOriginMutation } from "@/lib/server/openrouter-integration-security";
import {
  parseSavedPromptInput, SAVED_PROMPT_LIST_LIMIT, toSavedPromptDto,
  type SavedPromptRow,
} from "@/lib/server/saved-prompts";

export const dynamic = "force-dynamic";
const ROUTE = "/api/saved-prompts";
const SELECT = "id, title, prompt_text, created_at, updated_at";
const NO_STORE = { "Cache-Control": "private, no-store" };

async function requireUser(request: NextRequest, action: "read" | "write"): Promise<string> {
  const userId = await getAuthenticatedUserId(request);
  if (!userId) {
    throw new ApiError(401, "AUTH_REQUIRED", "Sign in to manage saved prompts.");
  }
  const limit = await checkRateLimit(
    "saved-prompts:" + action + ":" + userId,
    action === "read" ? 60 : 20,
    60_000
  );
  if (limit.limited) {
    throw new ApiError(429, "RATE_LIMIT", "Too many requests. Please try again later.");
  }
  return userId;
}

function failure(error: unknown, method: string, start: number): NextResponse {
  const status = error instanceof ApiError ? error.statusCode : 500;
  if (status === 500) console.error("Saved prompts request failed:", error);
  logApiRequest(method, ROUTE, status, Date.now() - start);
  return NextResponse.json(createErrorResponse(error), { status, headers: NO_STORE });
}

/** List at most 50 drafts owned by this verified account; no shared cache. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  try {
    const userId = await requireUser(request, "read");
    const db = getSupabaseServerClient();
    if (!db) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database unavailable.");

    const { data, error } = await db.from("saved_prompts")
      .select(SELECT)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(SAVED_PROMPT_LIST_LIMIT);
    if (error) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Cannot load saved prompts.");

    logApiRequest("GET", ROUTE, 200, Date.now() - start);
    return NextResponse.json({
      status: "success",
      items: ((data ?? []) as SavedPromptRow[]).map(toSavedPromptDto),
    }, { headers: NO_STORE });
  } catch (error) {
    return failure(error, "GET", start);
  }
}

/** Create one saved prompt; the user_id is always derived from verified auth. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const start = Date.now();
  try {
    requireSameOriginMutation(request);
    const userId = await requireUser(request, "write");
    let body: unknown;
    try { body = await request.json(); }
    catch { throw new ApiError(400, "INVALID_JSON", "Body must be valid JSON."); }
    const input = parseSavedPromptInput(body, "create");
    const db = getSupabaseServerClient();
    if (!db) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Database unavailable.");

    const { data, error } = await db.from("saved_prompts")
      .insert({ user_id: userId, title: input.title!, prompt_text: input.prompt_text! })
      .select(SELECT)
      .single();
    if (error || !data) throw new ApiError(503, "PERSISTENCE_UNAVAILABLE", "Cannot save prompt.");

    revalidatePath("/saved-prompts");
    logApiRequest("POST", ROUTE, 201, Date.now() - start);
    return NextResponse.json({
      status: "success",
      item: toSavedPromptDto(data as SavedPromptRow),
    }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return failure(error, "POST", start);
  }
}
