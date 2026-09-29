import { NextRequest, NextResponse } from "next/server";
import { IMAGE_MODELS } from "@/lib/arena/image-models";
import {
  IMAGE_MAX_PROMPT_CHARS,
  IMAGE_MAX_MODELS,
  IMAGE_RATE_LIMIT_MAX,
  IMAGE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";
import {
  logApiRequest,
  resolveRequestIdentity,
  checkRateLimit,
  executeOpenRouterImage,
  getApiKey,
  getSupabaseServerClient,
  isJsonObject,
  normalizeOpenRouterUsage,
} from "@/lib/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const PROVIDER_IMAGE_GENERATION_TIMEOUT_MS = 45_000;
// Reserve 15s of the 60s route budget for response validation, storage upload and serialization.
const PROVIDER_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const PROVIDER_IMAGE_MAX_BASE64_CHARS = Math.ceil(PROVIDER_IMAGE_MAX_BYTES / 3) * 4;
const PROVIDER_IMAGE_MAX_RESPONSE_BYTES = PROVIDER_IMAGE_MAX_BASE64_CHARS + 64 * 1024;
const PROVIDER_IMAGE_CONTENT_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
]);

interface ImageGenerationResult {
  id?: unknown;
  model?: unknown;
  usage?: unknown;
  data?: { b64_json?: unknown; media_type?: unknown }[];
}

interface DecodedProviderImage {
  bytes: ArrayBuffer;
  contentType: string;
  extension: string;
}

type SupabaseServerClient = NonNullable<ReturnType<typeof getSupabaseServerClient>>;
type ImageStorageBucket = ReturnType<SupabaseServerClient["storage"]["from"]>;

type BoundedJsonResult =
  | { success: true; data: unknown }
  | { success: false; reason: "invalid" | "too_large" };

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // Cancellation is best effort after the response has already been rejected.
  }
}

async function readBoundedProviderJson(response: Response): Promise<BoundedJsonResult> {
  const rawContentLength = response.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = Number(rawContentLength);
    if (Number.isFinite(contentLength) && contentLength > PROVIDER_IMAGE_MAX_RESPONSE_BYTES) {
      await cancelResponseBody(response);
      return { success: false, reason: "too_large" };
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return { success: false, reason: "invalid" };
  }

  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let receivedBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      receivedBytes += value.byteLength;
      if (receivedBytes > PROVIDER_IMAGE_MAX_RESPONSE_BYTES) {
        try {
          await reader.cancel();
        } catch {
          // The response is already rejected; cancellation is best effort.
        }
        return { success: false, reason: "too_large" };
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } catch {
    return { success: false, reason: "invalid" };
  }

  try {
    return { success: true, data: JSON.parse(chunks.join("")) as unknown };
  } catch {
    return { success: false, reason: "invalid" };
  }
}

function detectProviderImageType(bytes: Uint8Array): {
  contentType: string;
  extension: string;
} | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { contentType: "image/png", extension: "png" };
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { contentType: "image/webp", extension: "webp" };
  }

  return null;
}

function isBase64DataCharacter(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2b ||
    code === 0x2f
  );
}

function decodeProviderImage(value: string, declaredMediaType?: unknown): DecodedProviderImage | null {
  if (
    value.length === 0 ||
    value.length > PROVIDER_IMAGE_MAX_BASE64_CHARS ||
    value.length % 4 !== 0
  ) {
    return null;
  }

  const paddingLength = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const dataLength = value.length - paddingLength;
  const decodedLength = (value.length / 4) * 3 - paddingLength;
  if (dataLength === 0 || decodedLength > PROVIDER_IMAGE_MAX_BYTES) {
    return null;
  }

  for (let index = 0; index < dataLength; index += 1) {
    if (!isBase64DataCharacter(value.charCodeAt(index))) {
      return null;
    }
  }
  for (let index = dataLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) {
      return null;
    }
  }

  const decoded = Buffer.from(value, "base64");
  if (
    decoded.byteLength === 0 ||
    decoded.byteLength > PROVIDER_IMAGE_MAX_BYTES ||
    decoded.toString("base64") !== value
  ) {
    return null;
  }

  const bytes = Uint8Array.from(decoded);
  const detectedType = detectProviderImageType(bytes);
  if (!detectedType) {
    return null;
  }

  if (declaredMediaType !== undefined) {
    if (typeof declaredMediaType !== "string") {
      return null;
    }
    const normalizedMediaType = declaredMediaType.trim().toLowerCase();
    const declaredExtension = PROVIDER_IMAGE_CONTENT_TYPES.get(normalizedMediaType);
    if (!declaredExtension || normalizedMediaType !== detectedType.contentType) {
      return null;
    }
  }

  return { bytes: bytes.buffer, ...detectedType };
}

async function generateImage(
  modelId: string,
  prompt: string,
  userId: string
): Promise<{ image: DecodedProviderImage } | { error: string }> {
  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch {
    console.warn("[image-compare] Provider configuration unavailable", {
      modelId,
    });
    return { error: "Image generation is not configured" };
  }

  try {
    return await executeOpenRouterImage({
      prompt,
      modelId,
      credential: {
        billingSource: "platform",
        credentialId: null,
        apiKey,
      },
      telemetry: {
        userId,
        guestId: null,
        modeSlug: "image-arena",
        requestKind: "image",
      },
      timeoutMs: PROVIDER_IMAGE_GENERATION_TIMEOUT_MS,
      consumeResponse: async (response) => {
        const providerJson = await readBoundedProviderJson(response);
        if (!providerJson.success || !isJsonObject(providerJson.data)) {
          console.warn(
            "[image-compare] Provider returned an invalid response",
            {
              modelId,
              reason: providerJson.success
                ? "invalid_shape"
                : providerJson.reason,
            }
          );
          return {
            value: {
              error: "Image provider returned an invalid response",
            } as const,
            errorCode: "INVALID_RESPONSE",
          };
        }

        const data = providerJson.data as ImageGenerationResult;
        const providerRequestId =
          typeof data.id === "string" && data.id.trim() ? data.id : null;
        const providerModelId =
          typeof data.model === "string" && data.model.trim()
            ? data.model
            : null;
        const usage = normalizeOpenRouterUsage(data.usage);
        const providerImage = data.data?.[0];

        if (!providerImage || typeof providerImage.b64_json !== "string") {
          return {
            value: {
              error: "No image data returned by provider",
            } as const,
            usage,
            providerRequestId,
            providerModelId,
            errorCode: "INVALID_RESPONSE",
          };
        }

        const decodedImage = decodeProviderImage(
          providerImage.b64_json,
          providerImage.media_type
        );
        if (!decodedImage) {
          return {
            value: {
              error: "Provider image data failed validation",
            } as const,
            usage,
            providerRequestId,
            providerModelId,
            errorCode: "INVALID_RESPONSE",
          };
        }

        return {
          value: { image: decodedImage } as const,
          usage,
          providerRequestId,
          providerModelId,
          errorCode: null,
        };
      },
    });
  } catch {
    return { error: "Image provider request failed" };
  }
}

async function uploadToStorage(
  bucket: ImageStorageBucket,
  taskId: string,
  modelId: string,
  image: DecodedProviderImage
): Promise<{ url: string } | { error: string }> {
  const safeModelId = modelId.replace(/[^a-zA-Z0-9_-]/g, "-");
  const path = `arena-images/${taskId}/${safeModelId}.${image.extension}`;
  try {
    const { error } = await bucket.upload(path, image.bytes, {
      contentType: image.contentType,
      upsert: true,
    });

    if (error) {
      console.warn("[image-compare] Storage upload failed", { modelId });
      return { error: "Image storage upload failed" };
    }

    const publicUrl = bucket.getPublicUrl(path).data?.publicUrl;
    if (typeof publicUrl !== "string" || publicUrl.length === 0) {
      console.warn("[image-compare] Storage public URL unavailable", { modelId });
      return { error: "Image storage is unavailable" };
    }
    return { url: publicUrl };
  } catch {
    console.warn("[image-compare] Storage operation failed", { modelId });
    return { error: "Image storage is unavailable" };
  }
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

  if (!isJsonObject(body)) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "INVALID_BODY", message: "Request body must be a JSON object." },
      { status: 400 }
    );
  }

  const { prompt, modelIds } = body;

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

  const selectedModelIds = modelIds as string[];
  if (new Set(selectedModelIds).size !== selectedModelIds.length) {
    logApiRequest("POST", "/api/image-compare", 400, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: "Model IDs must be unique" },
      { status: 400 }
    );
  }

  let imageStorageBucket: ImageStorageBucket;
  try {
    const supabase = getSupabaseServerClient();
    if (!supabase) {
      logApiRequest("POST", "/api/image-compare", 503, Date.now() - startTime, requestId);
      return NextResponse.json(
        { error: "IMAGE_STORAGE_UNAVAILABLE", message: "Image storage is not configured" },
        { status: 503 }
      );
    }
    imageStorageBucket = supabase.storage.from("images");
  } catch {
    console.warn("[image-compare] Storage initialization failed");
    logApiRequest("POST", "/api/image-compare", 503, Date.now() - startTime, requestId);
    return NextResponse.json(
      { error: "IMAGE_STORAGE_UNAVAILABLE", message: "Image storage is unavailable" },
      { status: 503 }
    );
  }

  const cleanPrompt = prompt.trim();
  const taskId = crypto.randomUUID();

  const results = await Promise.all(
    selectedModelIds.map(async (modelId) => {
      const model = IMAGE_MODELS.find((m) => m.id === modelId);
      const modelName = model?.name ?? modelId;

      try {
        const generated = await generateImage(
          modelId,
          cleanPrompt,
          identity.userId
        );
        if ("error" in generated) {
          return { modelId, modelName, imageUrl: null, error: generated.error };
        }

        const uploaded = await uploadToStorage(imageStorageBucket, taskId, modelId, generated.image);
        if ("error" in uploaded) {
          return { modelId, modelName, imageUrl: null, error: uploaded.error };
        }
        return { modelId, modelName, imageUrl: uploaded.url, error: undefined };
      } catch {
        console.warn("[image-compare] Model pipeline failed", { modelId });
        return { modelId, modelName, imageUrl: null, error: "Image generation failed" };
      }
    })
  );

  logApiRequest("POST", "/api/image-compare", 200, Date.now() - startTime, requestId);
  return NextResponse.json({ taskId, results }, { status: 200 });
}
