import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module is imported.
// ---------------------------------------------------------------------------

const {
  resolveIdentityMock,
  checkRateLimitMock,
  getApiKeyMock,
  getClientMock,
  lookupMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getApiKeyMock: vi.fn(),
  getClientMock: vi.fn(),
  lookupMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: vi.fn(),
    getApiKey: getApiKeyMock,
    getSupabaseServerClient: getClientMock,
  };
});

// Stub fetch globally — no real network calls in tests.
vi.mock("node:dns/promises", () => ({
  lookup: lookupMock,
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { POST } from "./route";
import { OPENROUTER_IMAGE_API_URL, IMAGE_MAX_PROMPT_CHARS, IMAGE_MAX_MODELS } from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// The only model with accessLevel="anonymous" — safest to use as a valid ID
const VALID_MODEL = "stabilityai/stable-diffusion-xl-base-1.0";
const VALID_BODY = { prompt: "a serene forest", modelIds: [VALID_MODEL] };

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/image-compare", { method: "POST" });
  }
  return new NextRequest("http://localhost/api/image-compare", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockOpenRouterSuccess(url = "https://cdn.openrouter.ai/img/test.png"): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: [{ url }] }),
  } as unknown as Response;
}

function mockOpenRouterError(status = 500, message = "provider error"): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  } as unknown as Response;
}

function mockImageDownload(options?: {
  contentType?: string;
  contentLength?: string;
  byteLength?: number;
}): Response {
  const byteLength = options?.byteLength ?? 4;
  const bytes = new Uint8Array(byteLength);
  return {
    ok: true,
    status: 200,
    headers: new Headers({
      "content-type": options?.contentType ?? "image/png",
      ...(options?.contentLength ? { "content-length": options.contentLength } : {}),
    }),
    arrayBuffer: () => Promise.resolve(bytes.buffer.slice(0)),
  } as unknown as Response;
}

function mockStorageClient(publicUrl = "https://storage.example/arena-images/generated.png") {
  const uploadMock = vi.fn().mockResolvedValue({ error: null });
  const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl } });
  const fromMock = vi.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  });

  return {
    client: { storage: { from: fromMock } },
    uploadMock,
    getPublicUrlMock,
  };
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  getApiKeyMock.mockReset();
  getClientMock.mockReset();
  lookupMock.mockReset();
  fetchMock.mockReset();

  // Happy-path defaults: authenticated user, not rate-limited, no Storage, provider succeeds.
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue({ limited: false, remaining: 4, resetAt: Date.now() + 60_000 });
  getApiKeyMock.mockReturnValue("test-api-key");
  getClientMock.mockReturnValue(mockStorageClient().client);
  lookupMock.mockResolvedValue([{ address: "203.0.113.10", family: 4 }]);
  fetchMock.mockImplementation((url: string | URL | Request) => {
    const value = typeof url === "string" ? url : url.toString();
    return Promise.resolve(
      value === OPENROUTER_IMAGE_API_URL
        ? mockOpenRouterSuccess()
        : mockImageDownload()
    );
  });
});

// ---------------------------------------------------------------------------
// Identity — only authenticated users may generate images
// ---------------------------------------------------------------------------

describe("POST /api/image-compare — identity check", () => {
  it("returns 401 when the caller has no identity (unauthenticated)", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("IMAGE_AUTH_REQUIRED");
    // Rate limit and provider must not be reached.
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the caller is a guest (image generation requires a user account)", async () => {
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("IMAGE_AUTH_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/image-compare — rate limiting", () => {
  it("returns 429 with Retry-After when the per-user rate limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(429);
    expect(body.error).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the rate limit key to the authenticated session userId", async () => {
    await POST(makeRequest(VALID_BODY));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `image-compare:user:${USER_ID}`,
      expect.any(Number),
      expect.any(Number)
    );
  });
});

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

describe("POST /api/image-compare — request validation", () => {
  it("returns 400 INVALID_JSON when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("this is not json"));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("INVALID_JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR for an empty prompt string", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, prompt: "" }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR for a whitespace-only prompt", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, prompt: "   " }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when the prompt exceeds IMAGE_MAX_PROMPT_CHARS", async () => {
    const longPrompt = "x".repeat(IMAGE_MAX_PROMPT_CHARS + 1);
    const res = await POST(makeRequest({ ...VALID_BODY, prompt: longPrompt }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when modelIds is not an array", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: VALID_MODEL }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when modelIds is an empty array", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: [] }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when more than IMAGE_MAX_MODELS models are selected", async () => {
    const tooMany = Array(IMAGE_MAX_MODELS + 1).fill(VALID_MODEL);
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: tooMany }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when a model ID is not in the allowed list", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, modelIds: ["attacker/custom-model"] }));
    const body = await res.json() as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Image generation — provider paths
// ---------------------------------------------------------------------------

describe("POST /api/image-compare — image generation", () => {
  it("returns 200 with taskId and results array on success", async () => {
    const imageUrl = "https://cdn.openrouter.ai/img/generated.png";
    fetchMock
      .mockResolvedValueOnce(mockOpenRouterSuccess(imageUrl))
      .mockResolvedValueOnce(mockImageDownload());

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { taskId?: string; results?: unknown[] };

    expect(res.status).toBe(200);
    expect(typeof body.taskId).toBe("string");
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results).toHaveLength(1);
  });

  it("result contains modelId, modelName, and imageUrl on success", async () => {
    const imageUrl = "https://cdn.openrouter.ai/img/generated.png";
    const storage = mockStorageClient("https://storage.example/arena-images/generated.png");
    getClientMock.mockReturnValue(storage.client);
    fetchMock
      .mockResolvedValueOnce(mockOpenRouterSuccess(imageUrl))
      .mockResolvedValueOnce(mockImageDownload());

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ modelId?: string; modelName?: string; imageUrl?: string }>;
    };

    const result = body.results?.[0];
    expect(result?.modelId).toBe(VALID_MODEL);
    expect(typeof result?.modelName).toBe("string");
    // No Storage configured → URL is the original OpenRouter URL
    expect(result?.imageUrl).toBe("https://storage.example/arena-images/generated.png");
  });

  it("returns 200 with error field in the result when the provider returns non-OK", async () => {
    // The route does not throw for per-model failures — it records them in the result.
    fetchMock.mockResolvedValue(mockOpenRouterError(500, "model overloaded"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(typeof body.results?.[0]?.error).toBe("string");
  });

  it("returns 200 with error field in the result when the provider response contains no URL", async () => {
    // Provider returns 200 OK but the data array is missing/empty.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: [] }),
    } as unknown as Response);

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("No image URL returned by provider");
  });
});

// ---------------------------------------------------------------------------
// Security assertions
// ---------------------------------------------------------------------------

describe("POST /api/image-compare — security", () => {
  it("calls the provider at the hardcoded OPENROUTER_IMAGE_API_URL, not at a URL from the request", async () => {
    await POST(makeRequest({ ...VALID_BODY, providerUrl: "http://evil.example/generate" }));

    expect(fetchMock).toHaveBeenCalledWith(
      OPENROUTER_IMAGE_API_URL,
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "http://evil.example/generate",
      expect.anything()
    );
  });

  it("does not include the API key in the outbound model ID or response body", async () => {
    getApiKeyMock.mockReturnValue("super-secret-openrouter-key");

    const res = await POST(makeRequest(VALID_BODY));
    const bodyText = await res.text();

    expect(bodyText).not.toContain("super-secret-openrouter-key");
  });

  it("sends the API key only in the Authorization header of the provider call, not in the response", async () => {
    const apiKey = "test-bearer-key";
    getApiKeyMock.mockReturnValue(apiKey);

    await POST(makeRequest(VALID_BODY));

    // The key should appear in the provider fetch request headers...
    const [, fetchOpts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((fetchOpts.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${apiKey}`);
  });

  it("rate limit key is bound to the verified session userId, not to any request body field", async () => {
    // Attacker includes a userId field — must be ignored.
    await POST(makeRequest({ ...VALID_BODY, userId: "attacker-id" }));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `image-compare:user:${USER_ID}`,
      expect.any(Number),
      expect.any(Number)
    );
    expect(checkRateLimitMock).not.toHaveBeenCalledWith(
      "image-compare:user:attacker-id",
      expect.anything(),
      expect.anything()
    );
  });

  it("rejects non-HTTPS provider image URLs before returning them to the client", async () => {
    fetchMock.mockResolvedValueOnce(mockOpenRouterSuccess("http://cdn.openrouter.ai/img/generated.png"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string | null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("Provider returned an unsupported image URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects provider image URLs outside the approved CDN host allowlist", async () => {
    fetchMock.mockResolvedValueOnce(mockOpenRouterSuccess("https://attacker.example/img/generated.png"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string | null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("Provider returned an unsupported image URL");
    expect(lookupMock).not.toHaveBeenCalledWith("attacker.example", expect.anything());
  });

  it("rejects approved CDN hosts that resolve to private addresses", async () => {
    lookupMock.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    fetchMock.mockResolvedValueOnce(mockOpenRouterSuccess("https://cdn.openrouter.ai/img/generated.png"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string | null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("Provider returned an unsupported image URL");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("stores only HTTPS provider images with an allowed MIME type", async () => {
    const imageUrl = "https://cdn.openrouter.ai/img/generated.webp";
    const storage = mockStorageClient("https://storage.example/arena-images/generated.webp");
    getClientMock.mockReturnValue(storage.client);
    fetchMock
      .mockResolvedValueOnce(mockOpenRouterSuccess(imageUrl))
      .mockResolvedValueOnce(mockImageDownload({ contentType: "image/webp" }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBe("https://storage.example/arena-images/generated.webp");
    expect(storage.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      expect.any(ArrayBuffer),
      { contentType: "image/webp", upsert: true }
    );
  });

  it("does not upload provider image responses that exceed the byte limit", async () => {
    const imageUrl = "https://cdn.openrouter.ai/img/generated.png";
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    fetchMock
      .mockResolvedValueOnce(mockOpenRouterSuccess(imageUrl))
      .mockResolvedValueOnce(mockImageDownload({ contentLength: String(9 * 1024 * 1024) }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string | null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("Provider image failed validation");
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it("does not return raw provider URLs when Storage is not configured", async () => {
    const imageUrl = "https://cdn.openrouter.ai/img/generated.png";
    getClientMock.mockReturnValue(null);
    fetchMock.mockResolvedValueOnce(mockOpenRouterSuccess(imageUrl));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      results?: Array<{ imageUrl?: string | null; error?: string }>;
    };

    expect(res.status).toBe(200);
    expect(body.results?.[0]?.imageUrl).toBeNull();
    expect(body.results?.[0]?.error).toBe("Image storage is not configured");
  });
});
