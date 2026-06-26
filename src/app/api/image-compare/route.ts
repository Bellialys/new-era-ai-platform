import { NextRequest, NextResponse } from "next/server";
import { IMAGE_MODELS } from "@/lib/arena/image-models";
import {
  IMAGE_MAX_PROMPT_CHARS,
  IMAGE_MAX_MODELS,
  IMAGE_RATE_LIMIT_MAX,
  IMAGE_RATE_LIMIT_WINDOW_MS,
  IMAGE_SIZE,
  OPENROUTER_IMAGE_API_URL,
} from "@/lib/arena/constants";
import {
  logApiRequest,
  resolveRequestIdentity,
  checkRateLimit,
  getApiKey,
  getSupabaseServerClient,
} from "@/lib/server";

export const maxDuration = 60;

interface ImageGenerationResult {
  data?: { url?: string }[];
  error?: { message?: string; code?: string | number };
}

async function generateImage(
  modelId: string,
  prompt: string
): Promise<{ url: string } | { error: string }> {
  const apiKey = getApiKey();

  const res = await fetch(OPENROUTER_IMAGE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-Title": "New Era AI Platform",
    },
    body: JSON.stringify({ model: modelId, prompt, n: 1, size: IMAGE_SIZE, response_format: "url" }),
  });

  if (!res.ok) {
    let msg = `OpenRouter image API returned ${res.status}`;
    try {
      const data = (await res.json()) as ImageGenerationResult;
      if (data.error?.message) msg = String(data.error.message);
    } catch { /* ignore */ }
    return { error: msg };
  }

  const data = (await res.json()) as ImageGenerationResult;
  const url = data.data?.[0]?.url;
  if (!url) {
    return { error: "No image URL returned by provider" };
  }
  return { url };
}

async function uploadToStorage(
  taskId: string,
  modelId: string,
  imageUrl: string
): Promise<string> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return imageUrl;
  }

  let imageBytes: ArrayBuffer;
  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return imageUrl;
    imageBytes = await imgRes.arrayBuffer();
  } catch {
    return imageUrl;
  }

  const path = `arena-images/${taskId}/${modelId.replace(/\//g, "-")}.png`;
  const { error } = await supabase.storage
    .from("images")
    .upload(path, imageBytes, { contentType: "image/png", upsert: true });

  if (error) {
    console.warn("[image-compare] Storage upload failed:", error.message);
    return imageUrl;
  }

  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return data.publicUrl;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  const identity = await resolveRequestIdentity(request);
  if (identity.kind !== "user") {
    logApiRequest("POST", "/api/image-compare", 401, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "IMAGE_AUTH_REQUIRED", message: "Image Arena требует аккаунт" },
      { status: 401 }
    );
  }

  const rateLimitKey = `image-compare:user:${identity.userId}`;
  const rateLimit = await checkRateLimit(rateLimitKey, IMAGE_RATE_LIMIT_MAX, IMAGE_RATE_LIMIT_WINDOW_MS);
  if (rateLimit.limited) {
    logApiRequest("POST", "/api/image-compare", 429, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "RATE_LIMIT", message: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json({ error: "INVALID_JSON", message: "Invalid request body" }, { status: 400 });
  }

  const { prompt, modelIds } = body as { prompt?: unknown; modelIds?: unknown };

  if (typeof prompt !== "string" || prompt.trim().length === 0) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json({ error: "VALIDATION_ERROR", message: "Prompt is required" }, { status: 400 });
  }
  if (prompt.trim().length > IMAGE_MAX_PROMPT_CHARS) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: `Prompt must be at most ${IMAGE_MAX_PROMPT_CHARS} characters` },
      { status: 400 }
    );
  }

  if (!Array.isArray(modelIds) || modelIds.length < 1 || modelIds.length > IMAGE_MAX_MODELS) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: `Select 1 to ${IMAGE_MAX_MODELS} models` },
      { status: 400 }
    );
  }

  const allowedIds = IMAGE_MODELS.map((m) => m.id as string);
  const invalidId = (modelIds as unknown[]).find(
    (id) => typeof id !== "string" || !allowedIds.includes(id)
  );
  if (invalidId !== undefined) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "One or more model IDs are not supported" },
      { status: 400 }
    );
  }

  const cleanPrompt = prompt.trim();
  const selectedModelIds = modelIds as string[];
  const taskId = crypto.randomUUID();

  const results = await Promise.all(
    selectedModelIds.map(async (modelId) => {
      const model = IMAGE_MODELS.find((m) => m.id === modelId);
      const modelName = model?.name ?? modelId;

      const generated = await generateImage(modelId, cleanPrompt);
      if ("error" in generated) {
        return { modelId, modelName, imageUrl: null, error: generated.error };
      }

      const imageUrl = await uploadToStorage(taskId, modelId, generated.url);
      return { modelId, modelName, imageUrl, error: undefined };
    })
  );

  logApiRequest("POST", "/api/image-compare", 200, Date.now() - startTime, requestId);
  return NextResponse.json({ taskId, results }, { status: 200 });
}
