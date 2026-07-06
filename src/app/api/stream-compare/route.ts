import { NextRequest } from "next/server";
import {
  PROMPT_MIN_LENGTH,
  PROMPT_MAX_LENGTH,
  MODEL_MIN_SELECT,
  MODEL_MAX_SELECT,
  COMPARE_RATE_LIMIT_MAX_REQUESTS,
  COMPARE_RATE_LIMIT_WINDOW_MS,
  GUEST_COMPARE_RATE_LIMIT_MAX_REQUESTS,
  GUEST_COMPARE_RATE_LIMIT_WINDOW_MS,
  MODE_SLUG_PROMPT_ARENA,
} from "@/lib/arena/constants";
import {
  validatePrompt,
  validateModelIds,
  validateModeSlug,
  resolveSelectedModels,
  ApiError,
  saveArenaRun,
  checkRateLimit,
  resolveRequestIdentity,
  getApiKey,
  logApiRequest,
  checkDailyLimit,
  fisherYatesShuffle,
  blindSlotId,
  blindSlotName,
} from "@/lib/server";

// Vercel: allow up to 60s for OpenRouter AI calls
export const maxDuration = 60;

import type { ResolvedModel } from "@/lib/server/model-catalog";

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------
const enc = new TextEncoder();
const PUBLIC_STREAM_MODEL_ERROR_MESSAGE = "Model response failed. Please try again.";

function sse(event: string, data: unknown): Uint8Array {
  return enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

type WireModelDescriptor = {
  id: string;
  name: string;
  role: string | null;
};

function wireForModel(
  model: ResolvedModel,
  index: number,
  isBlind: boolean
): WireModelDescriptor {
  return isBlind
    ? { id: blindSlotId(index), name: blindSlotName(index), role: null }
    : { id: model.selectionId, name: model.name, role: model.role };
}

// ---------------------------------------------------------------------------
// Stream one model via OpenRouter streaming API
// ---------------------------------------------------------------------------
async function streamOneModel(
  prompt: string,
  model: ResolvedModel,
  wire: WireModelDescriptor,
  controller: ReadableStreamDefaultController<Uint8Array>,
  signal: AbortSignal
): Promise<{ text: string; latencyMs: number; inputTokens: number | null; outputTokens: number | null; success: boolean; errorCode?: string; errorMessage?: string }> {
  const apiKey = getApiKey();
  const startTime = Date.now();

  // Announce model start
  controller.enqueue(sse("model_start", {
    modelId: wire.id,
    modelName: wire.name,
    modelRole: wire.role,
  }));

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
        "X-Title": "New Era AI Platform",
      },
      body: JSON.stringify({
        model: model.modelKey,
        messages: [{ role: "user", content: prompt }],
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      }),
      signal,
    });

    if (!res.ok || !res.body) {
      const msg = `OpenRouter returned ${res.status}`;
      const errorCode = res.status === 429 ? "RATE_LIMIT" : res.status >= 500 ? "PROVIDER_ERROR" : "OPENROUTER_ERROR";
      controller.enqueue(sse("model_error", {
        modelId: wire.id,
        response: {
          id: crypto.randomUUID(),
          modelId: wire.id,
          modelName: wire.name,
          status: "error",
          answerText: null,
          errorCode,
          errorMessage: msg,
        },
      }));
      return { text: "", latencyMs: Date.now() - startTime, inputTokens: null, outputTokens: null, success: false, errorCode, errorMessage: msg };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let accumulated = "";
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: { delta?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            accumulated += token;
            controller.enqueue(sse("model_token", { modelId: wire.id, token }));
          }
          if (parsed.usage) {
            inputTokens = parsed.usage.prompt_tokens ?? null;
            outputTokens = parsed.usage.completion_tokens ?? null;
          }
        } catch { /* skip malformed */ }
      }
    }

    const latencyMs = Date.now() - startTime;
    controller.enqueue(sse("model_done", {
      modelId: wire.id,
      response: {
        id: crypto.randomUUID(),
        modelId: wire.id,
        modelName: wire.name,
        status: "success",
        answerText: accumulated,
        latencyMs,
      },
    }));

    return { text: accumulated, latencyMs, inputTokens, outputTokens, success: true };
  } catch (err) {
    if (signal.aborted) return { text: "", latencyMs: 0, inputTokens: null, outputTokens: null, success: false, errorCode: "ABORTED", errorMessage: "Aborted" };
    console.error("stream-compare model stream failed:", err);
    controller.enqueue(sse("model_error", {
      modelId: wire.id,
      response: {
        id: crypto.randomUUID(),
        modelId: wire.id,
        modelName: wire.name,
        status: "error",
        answerText: null,
        errorCode: "NETWORK_ERROR",
        errorMessage: PUBLIC_STREAM_MODEL_ERROR_MESSAGE,
      },
    }));
    return {
      text: "",
      latencyMs: Date.now() - startTime,
      inputTokens: null,
      outputTokens: null,
      success: false,
      errorCode: "NETWORK_ERROR",
      errorMessage: PUBLIC_STREAM_MODEL_ERROR_MESSAGE,
    };
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
interface StreamCompareRequest {
  prompt?: unknown;
  modelIds?: unknown;
  modeSlug?: unknown;
  blind?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  const startTime = Date.now();
  // Resolve identity & validate before opening the stream
  const identity = await resolveRequestIdentity(request);
  if (identity.kind === "none") {
    logApiRequest("POST", "/api/stream-compare", 401, Date.now() - startTime);
    return new Response(
      JSON.stringify({ status: "error", error: { code: "AUTH_REQUIRED", message: "Sign in or continue as a guest." } }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const dailyCheck = await checkDailyLimit(identity.userId, identity.guestId);
  if (!dailyCheck.allowed) {
    logApiRequest("POST", "/api/stream-compare", 429, Date.now() - startTime);
    return new Response(
      JSON.stringify({
        error: "DAILY_LIMIT_EXCEEDED",
        used: dailyCheck.used,
        limit: dailyCheck.limit,
        message: "Дневной лимит запросов исчерпан. Обновите план для большего количества запросов.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  const rateLimitKey = `stream-compare:${identity.kind === "user" ? `user:${identity.userId}` : `guest:${identity.guestId}`}`;
  const isGuest = identity.kind === "guest";
  const rateLimit = await checkRateLimit(
    rateLimitKey,
    isGuest ? GUEST_COMPARE_RATE_LIMIT_MAX_REQUESTS : COMPARE_RATE_LIMIT_MAX_REQUESTS,
    isGuest ? GUEST_COMPARE_RATE_LIMIT_WINDOW_MS : COMPARE_RATE_LIMIT_WINDOW_MS
  );
  if (rateLimit.limited) {
    logApiRequest("POST", "/api/stream-compare", 429, Date.now() - startTime);
    return new Response(
      JSON.stringify({ status: "error", error: { code: "RATE_LIMIT", message: "Too many requests." } }),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    logApiRequest("POST", "/api/stream-compare", 400, Date.now() - startTime);
    return new Response(JSON.stringify({ status: "error", error: { code: "INVALID_JSON" } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const { prompt, modelIds, modeSlug, blind } = body as StreamCompareRequest;
  const isBlind = blind === true;

  const modeValidation = validateModeSlug(modeSlug, MODE_SLUG_PROMPT_ARENA);
  if (!modeValidation.valid) {
    logApiRequest("POST", "/api/stream-compare", 400, Date.now() - startTime);
    return new Response(JSON.stringify({ status: "error", error: { code: "INVALID_MODE", message: modeValidation.error } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const promptValidation = validatePrompt(prompt, PROMPT_MIN_LENGTH, PROMPT_MAX_LENGTH);
  if (!promptValidation.valid) {
    logApiRequest("POST", "/api/stream-compare", 400, Date.now() - startTime);
    return new Response(JSON.stringify({ status: "error", error: { code: "VALIDATION_ERROR", message: promptValidation.error } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const cleanPrompt = promptValidation.value ?? "";

  const modelIdValidation = validateModelIds(modelIds, MODEL_MIN_SELECT, MODEL_MAX_SELECT);
  if (!modelIdValidation.valid) {
    logApiRequest("POST", "/api/stream-compare", 400, Date.now() - startTime);
    return new Response(JSON.stringify({ status: "error", error: { code: "VALIDATION_ERROR", message: modelIdValidation.error } }), { status: 400, headers: { "Content-Type": "application/json" } });
  }
  const selectedModelIds = modelIdValidation.value ?? [];

  let selectedModels: ResolvedModel[];
  try {
    selectedModels = await resolveSelectedModels(selectedModelIds, identity);
  } catch (err) {
    const ae = err instanceof ApiError ? err : new ApiError(403, "MODEL_NOT_ALLOWED", "Model not allowed.");
    logApiRequest("POST", "/api/stream-compare", ae.statusCode, Date.now() - startTime);
    return new Response(JSON.stringify({ status: "error", error: { code: ae.errorCode, message: ae.message } }), { status: ae.statusCode, headers: { "Content-Type": "application/json" } });
  }

  const orderedModels = isBlind ? fisherYatesShuffle(selectedModels) : selectedModels;
  const orderedWires = orderedModels.map((model, index) =>
    wireForModel(model, index, isBlind)
  );

  const abortController = new AbortController();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamStatus = 200;
      try {
        // Stream all models in parallel
        const modelResults = await Promise.all(
          orderedModels.map((model, index) =>
            streamOneModel(
              cleanPrompt,
              model,
              orderedWires[index] ?? wireForModel(model, index, isBlind),
              controller,
              abortController.signal
            )
          )
        );

        // Persist best-effort
        const persistItems = orderedModels.map((model, i) => {
          const r = modelResults[i];
          return {
            id: crypto.randomUUID(),
            modelId: model.selectionId,
            modelKey: model.modelKey,
            dbModelId: model.modelId,
            modelName: model.name,
            status: (r.success ? "success" : "error") as "success" | "error",
            answerText: r.success ? r.text : null,
            latencyMs: r.latencyMs,
            errorCode: r.errorCode,
            errorMessage: r.errorMessage,
            usage: r.success ? { inputTokens: r.inputTokens, outputTokens: r.outputTokens, totalTokens: null } : undefined,
          };
        });

        let taskId: string | null = null;
        let responseIdsByModelId: Record<string, string> = {};
        try {
          const saved = await saveArenaRun({
            prompt: cleanPrompt,
            modeSlug: MODE_SLUG_PROMPT_ARENA,
            modelKeys: orderedModels.map((m) => m.modelKey),
            responses: persistItems,
            owner: { userId: identity.userId, anonymousSessionId: identity.guestId },
            isBlind,
          });
          taskId = saved.taskId;
          responseIdsByModelId = saved.responseIdsByModelId;
        } catch (e) {
          console.error("stream-compare persist failed:", e);
        }

        // Build final responses array for the complete event
        const finalResponses = persistItems.map((item, index) => {
          const wire = orderedWires[index] ?? {
            id: item.modelId,
            name: item.modelName,
            role: null,
          };

          return {
            id: responseIdsByModelId[item.modelId] ?? item.id,
            modelId: wire.id,
            modelName: wire.name,
            status: item.status,
            answerText: item.answerText,
            latencyMs: item.latencyMs,
            errorCode: item.errorCode,
            errorMessage: item.errorMessage,
          };
        });

        controller.enqueue(sse("complete", {
          status: finalResponses.some((r) => r.status === "success") ? "success" : "error",
          taskId,
          responses: finalResponses,
        }));

        controller.close();
      } catch (err) {
        streamStatus = 500;
        controller.error(err);
      } finally {
        logApiRequest("POST", "/api/stream-compare", streamStatus, Date.now() - startTime);
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  const headers: HeadersInit = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  };

  if (identity.kind === "guest") {
    const maxAge = 60 * 60 * 24 * 30;
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    headers["Set-Cookie"] = `na_guest=${identity.guestId}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Path=/${secure}`;
  }

  return new Response(stream, { headers });
}
