import { lookup } from "node:dns/promises";
import net from "node:net";
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

const PROVIDER_IMAGE_FETCH_TIMEOUT_MS = 10_000;
const PROVIDER_IMAGE_DNS_TIMEOUT_MS = 2_000;
const PROVIDER_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const PROVIDER_IMAGE_ALLOWED_HOSTS = new Set(["cdn.openrouter.ai"]);
const PROVIDER_IMAGE_CONTENT_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

interface ImageGenerationResult {
  data?: { url?: string }[];
  error?: { message?: string; code?: string | number };
}

function parseProviderImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isPrivateOrLocalAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) {
    const [first = 0, second = 0, third = 0] = address.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      first >= 224 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0 && third === 0)
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:192.168.")
    );
  }

  return true;
}

async function resolvesToPublicAddresses(hostname: string): Promise<boolean> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      lookup(hostname, { all: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("DNS_LOOKUP_TIMEOUT")), PROVIDER_IMAGE_DNS_TIMEOUT_MS);
      }),
    ]);
    return records.length > 0 && records.every((record) => !isPrivateOrLocalAddress(record.address));
  } catch {
    return false;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function getSafeProviderImageUrl(value: string): Promise<URL | null> {
  const url = parseProviderImageUrl(value);
  if (!url || !PROVIDER_IMAGE_ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  return (await resolvesToPublicAddresses(url.hostname)) ? url : null;
}

function getProviderImageType(response: Response): { contentType: string; extension: string } | null {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
  if (!contentType) return null;

  const extension = PROVIDER_IMAGE_CONTENT_TYPES.get(contentType);
  return extension ? { contentType, extension } : null;
}

function exceedsProviderImageLimit(response: Response): boolean {
  const rawLength = response.headers.get("content-length");
  if (!rawLength) return false;

  const contentLength = Number(rawLength);
  return Number.isFinite(contentLength) && contentLength > PROVIDER_IMAGE_MAX_BYTES;
}

async function readProviderImage(response: Response): Promise<{
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
} | null> {
  const imageType = getProviderImageType(response);
  if (!imageType || exceedsProviderImageLimit(response)) {
    return null;
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength > PROVIDER_IMAGE_MAX_BYTES) {
    return null;
  }

  return { bytes, ...imageType };
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
  if (!(await getSafeProviderImageUrl(url))) {
    return { error: "Provider returned an unsupported image URL" };
  }
  return { url };
}

async function uploadToStorage(
  taskId: string,
  modelId: string,
  imageUrl: string
): Promise<{ url: string } | { error: string }> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { error: "Image storage is not configured" };
  }

  const safeImageUrl = await getSafeProviderImageUrl(imageUrl);
  if (!safeImageUrl) {
    return { error: "Provider returned an unsupported image URL" };
  }

  let image: { bytes: ArrayBuffer; contentType: string; extension: string };
  try {
    const imgRes = await fetch(safeImageUrl.toString(), {
      signal: AbortSignal.timeout(PROVIDER_IMAGE_FETCH_TIMEOUT_MS),
    });
    if (!imgRes.ok) return { error: "Provider image could not be fetched" };
    const downloadedImage = await readProviderImage(imgRes);
    if (!downloadedImage) return { error: "Provider image failed validation" };
    image = downloadedImage;
  } catch {
    return { error: "Provider image could not be fetched" };
  }

  const path = `arena-images/${taskId}/${modelId.replace(/\//g, "-")}.${image.extension}`;
  const { error } = await supabase.storage
    .from("images")
    .upload(path, image.bytes, { contentType: image.contentType, upsert: true });

  if (error) {
    console.warn("[image-compare] Storage upload failed:", error.message);
    return { error: "Image storage upload failed" };
  }

  const { data } = supabase.storage.from("images").getPublicUrl(path);
  return { url: data.publicUrl };
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

      const uploaded = await uploadToStorage(taskId, modelId, generated.url);
      if ("error" in uploaded) {
        return { modelId, modelName, imageUrl: null, error: uploaded.error };
      }
      return { modelId, modelName, imageUrl: uploaded.url, error: undefined };
    })
  );

  logApiRequest("POST", "/api/image-compare", 200, Date.now() - startTime, requestId);
  return NextResponse.json({ taskId, results }, { status: 200 });
}
