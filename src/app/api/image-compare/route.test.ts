import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  resolveIdentityMock,
  checkRateLimitMock,
  getApiKeyMock,
  getClientMock,
  logApiRequestMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  getApiKeyMock: vi.fn(),
  getClientMock: vi.fn(),
  logApiRequestMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: logApiRequestMock,
    getApiKey: getApiKeyMock,
    getSupabaseServerClient: getClientMock,
  };
});

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const consoleWarnMock = vi.spyOn(console, "warn").mockImplementation(() => undefined);

import { POST } from "./route";
import {
  IMAGE_MAX_MODELS,
  IMAGE_MAX_PROMPT_CHARS,
  OPENROUTER_IMAGE_API_URL,
} from "@/lib/arena/constants";
import { IMAGE_MODELS } from "@/lib/arena/image-models";

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const VALID_MODEL = IMAGE_MODELS[0].id;
const SECOND_MODEL = IMAGE_MODELS[1].id;
const VALID_BODY = { prompt: "a serene forest", modelIds: [VALID_MODEL] };
const PNG_BYTES = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const WEBP_BYTES = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

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

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function mockOpenRouterSuccess(options?: {
  bytes?: Uint8Array;
  b64Json?: string;
  mediaType?: unknown;
  omitMediaType?: boolean;
}): Response {
  const image: { b64_json: string; media_type?: unknown } = {
    b64_json: options?.b64Json ?? toBase64(options?.bytes ?? PNG_BYTES),
  };
  if (!options?.omitMediaType) {
    image.media_type = options && "mediaType" in options ? options.mediaType : "image/png";
  }

  return new Response(JSON.stringify({ data: [image] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mockOpenRouterError(
  status = 500,
  message: unknown = "provider error",
  code: unknown = "PROVIDER_ERROR"
): Response {
  return new Response(JSON.stringify({ error: { message, code } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockStorageClient(
  publicUrl = "https://storage.example/arena-images/generated.png",
  uploadError: { message: string } | null = null
) {
  const uploadMock = vi.fn().mockResolvedValue({ error: uploadError });
  const getPublicUrlMock = vi.fn().mockReturnValue({ data: { publicUrl } });
  const fromMock = vi.fn().mockReturnValue({
    upload: uploadMock,
    getPublicUrl: getPublicUrlMock,
  });

  return {
    client: { storage: { from: fromMock } },
    fromMock,
    uploadMock,
    getPublicUrlMock,
  };
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  getApiKeyMock.mockReset();
  getClientMock.mockReset();
  logApiRequestMock.mockReset();
  fetchMock.mockReset();
  consoleWarnMock.mockClear();

  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue({
    limited: false,
    remaining: 4,
    resetAt: Date.now() + 60_000,
  });
  getApiKeyMock.mockReturnValue("test-api-key");
  getClientMock.mockReturnValue(mockStorageClient().client);
  fetchMock.mockImplementation(() => Promise.resolve(mockOpenRouterSuccess()));
});

afterAll(() => {
  consoleWarnMock.mockRestore();
});

describe("POST /api/image-compare — identity and rate limiting", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("IMAGE_AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 for a guest because Image Arena requires a registered user", async () => {
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("IMAGE_AUTH_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when the per-user limit is exceeded", async () => {
    checkRateLimitMock.mockResolvedValue({
      limited: true,
      remaining: 0,
      resetAt: Date.now() + 60_000,
    });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(429);
    expect(body.error).toBe("RATE_LIMIT");
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("binds the rate-limit key to the verified session user, not request input", async () => {
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
});

describe("POST /api/image-compare — request validation", () => {
  it("returns INVALID_JSON for malformed JSON", async () => {
    const response = await POST(makeRequest("this is not json"));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("INVALID_JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a controlled 400 when JSON body is null", async () => {
    const response = await POST(makeRequest(null));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["", "   "])("rejects an empty prompt (%j)", async (prompt) => {
    const response = await POST(makeRequest({ ...VALID_BODY, prompt }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a prompt over IMAGE_MAX_PROMPT_CHARS", async () => {
    const response = await POST(makeRequest({
      ...VALID_BODY,
      prompt: "x".repeat(IMAGE_MAX_PROMPT_CHARS + 1),
    }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    VALID_MODEL,
    [],
    Array(IMAGE_MAX_MODELS + 1).fill(VALID_MODEL),
    ["attacker/custom-model"],
  ])("rejects invalid model selection %#", async (modelIds) => {
    const response = await POST(makeRequest({ ...VALID_BODY, modelIds }));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate model IDs before any provider call", async () => {
    const response = await POST(makeRequest({
      prompt: VALID_BODY.prompt,
      modelIds: [VALID_MODEL, VALID_MODEL],
    }));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(400);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.message).toBe("Model IDs must be unique");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/image-compare — current OpenRouter image contract", () => {
  it("posts only provider-portable fields and uploads decoded bytes", async () => {
    const storage = mockStorageClient("https://storage.example/generated.png");
    getClientMock.mockReturnValue(storage.client);

    const response = await POST(makeRequest({ prompt: "  a serene forest  ", modelIds: [VALID_MODEL] }));
    const body = await response.json() as {
      taskId?: string;
      results?: Array<{ modelId: string; modelName: string; imageUrl: string | null; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.taskId).toEqual(expect.any(String));
    expect(body.results).toEqual([
      expect.objectContaining({
        modelId: VALID_MODEL,
        modelName: IMAGE_MODELS[0].name,
        imageUrl: "https://storage.example/generated.png",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [providerUrl, providerOptions] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(providerUrl).toBe(OPENROUTER_IMAGE_API_URL);
    expect(providerOptions.method).toBe("POST");
    expect(providerOptions.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(providerOptions.body))).toEqual({
      model: VALID_MODEL,
      prompt: "a serene forest",
      n: 1,
      aspect_ratio: "1:1",
    });
    expect(String(providerOptions.body)).not.toContain("response_format");
    expect(String(providerOptions.body)).not.toContain("resolution");
    expect(String(providerOptions.body)).not.toContain("output_format");
    expect(String(providerOptions.body)).not.toContain("size");

    expect(storage.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/\.png$/),
      expect.any(ArrayBuffer),
      { contentType: "image/png", upsert: true }
    );
    const uploadedBytes = storage.uploadMock.mock.calls[0]?.[1] as ArrayBuffer;
    expect(Array.from(new Uint8Array(uploadedBytes))).toEqual(Array.from(PNG_BYTES));
  });

  it("infers an allowed type from bytes when media_type is omitted", async () => {
    const storage = mockStorageClient("https://storage.example/generated.jpg");
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ bytes: JPEG_BYTES, omitMediaType: true }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: string | null }> };

    expect(response.status).toBe(200);
    expect(body.results[0]?.imageUrl).toBe("https://storage.example/generated.jpg");
    expect(storage.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/\.jpg$/),
      expect.any(ArrayBuffer),
      { contentType: "image/jpeg", upsert: true }
    );
  });

  it("supports validated WebP bytes without fetching a provider URL", async () => {
    const storage = mockStorageClient("https://storage.example/generated.webp");
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ bytes: WEBP_BYTES, mediaType: "image/webp" }));

    const response = await POST(makeRequest(VALID_BODY));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(storage.uploadMock).toHaveBeenCalledWith(
      expect.stringMatching(/\.webp$/),
      expect.any(ArrayBuffer),
      { contentType: "image/webp", upsert: true }
    );
  });

  it("keeps one model failure isolated from another model success", async () => {
    const storage = mockStorageClient("https://storage.example/generated.png");
    getClientMock.mockReturnValue(storage.client);
    fetchMock
      .mockResolvedValueOnce(mockOpenRouterError(503, "model overloaded"))
      .mockResolvedValueOnce(mockOpenRouterSuccess());

    const response = await POST(makeRequest({
      prompt: VALID_BODY.prompt,
      modelIds: [VALID_MODEL, SECOND_MODEL],
    }));
    const body = await response.json() as {
      results: Array<{ modelId: string; imageUrl: string | null; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(body.results[0]).toEqual(expect.objectContaining({
      modelId: VALID_MODEL,
      imageUrl: null,
      error: "Image provider request failed",
    }));
    expect(body.results[1]).toEqual(expect.objectContaining({
      modelId: SECOND_MODEL,
      imageUrl: "https://storage.example/generated.png",
    }));
  });

  it("returns a per-model error when the provider request rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network failure"));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(response.status).toBe(200);
    expect(body.results[0]).toEqual(expect.objectContaining({
      imageUrl: null,
      error: "Image provider request failed",
    }));
  });

  it("returns a per-model error when successful provider JSON is invalid", async () => {
    fetchMock.mockResolvedValue(new Response("{invalid JSON", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Image provider returned an invalid response");
  });

  it.each(["null", "[]", "42", '"unexpected"'])(
    "handles a non-object provider success payload without rejecting the route (%s)",
    async (providerBody) => {
      fetchMock.mockResolvedValue(new Response(providerBody, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }));

      const response = await POST(makeRequest(VALID_BODY));
      const body = await response.json() as {
        results: Array<{ imageUrl: null; error: string }>;
      };

      expect(response.status).toBe(200);
      expect(body.results[0]).toEqual(expect.objectContaining({
        imageUrl: null,
        error: "Image provider returned an invalid response",
      }));
    }
  );
});

describe("POST /api/image-compare — provider image validation", () => {
  it("rejects an upstream body whose declared size exceeds the bounded JSON limit", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    let cancelled = false;
    const providerStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(Uint8Array.of(0x7b));
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValue(new Response(providerStream, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": String(15 * 1024 * 1024 + 1),
      },
    }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(response.status).toBe(200);
    expect(body.results[0]?.error).toBe("Image provider returned an invalid response");
    expect(cancelled).toBe(true);
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it("cancels an upstream stream that exceeds the bounded JSON limit without Content-Length", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    const chunk = new Uint8Array(4 * 1024 * 1024).fill(0x41);
    let pulls = 0;
    let cancelled = false;
    const providerStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    });
    fetchMock.mockResolvedValue(new Response(providerStream, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Image provider returned an invalid response");
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThanOrEqual(5);
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it.each([
    { data: [] },
    { data: [{}] },
    { data: [{ url: "https://cdn.openrouter.ai/legacy.png" }] },
  ])("rejects missing b64_json without a second fetch (%#)", async (providerBody) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(providerBody), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(response.status).toBe(200);
    expect(body.results[0]).toEqual(expect.objectContaining({
      imageUrl: null,
      error: "No image data returned by provider",
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    "%%%not-base64%%%",
    "aW52YWxpZA",
    "data:image/png;base64,aW52YWxpZA==",
    "ZE==",
  ])("rejects malformed or non-canonical base64 (%s)", async (b64Json) => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ b64Json }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Provider image data failed validation");
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it.each(["image/svg+xml", "application/octet-stream", "text/html", null, 42])(
    "rejects disallowed or unknown declared media type %s",
    async (mediaType) => {
      const storage = mockStorageClient();
      getClientMock.mockReturnValue(storage.client);
      fetchMock.mockResolvedValue(mockOpenRouterSuccess({ mediaType }));

      const response = await POST(makeRequest(VALID_BODY));
      const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

      expect(body.results[0]?.error).toBe("Provider image data failed validation");
      expect(storage.uploadMock).not.toHaveBeenCalled();
    }
  );

  it("rejects an allowed declared type that does not match the byte signature", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ bytes: PNG_BYTES, mediaType: "image/jpeg" }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Provider image data failed validation");
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it("rejects unknown binary content even when it is valid base64", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({
      bytes: Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x3e]),
      omitMediaType: true,
    }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Provider image data failed validation");
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });

  it("accepts decoded image data at the 5 MiB Storage boundary", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    const boundaryBytes = new Uint8Array(5 * 1024 * 1024);
    boundaryBytes.set(PNG_BYTES);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ bytes: boundaryBytes }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: string | null; error?: string }> };

    expect(body.results[0]?.error).toBeUndefined();
    expect(body.results[0]?.imageUrl).toEqual(expect.any(String));
    expect(storage.uploadMock).toHaveBeenCalledOnce();
  });

  it("rejects decoded image data above the 5 MiB Storage limit", async () => {
    const storage = mockStorageClient();
    getClientMock.mockReturnValue(storage.client);
    const oversizedBytes = new Uint8Array(5 * 1024 * 1024 + 1);
    oversizedBytes.set(PNG_BYTES);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ bytes: oversizedBytes }));

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { results: Array<{ imageUrl: null; error: string }> };

    expect(body.results[0]?.error).toBe("Provider image data failed validation");
    expect(storage.uploadMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/image-compare — storage and secret safety", () => {
  it("keeps other model results when getApiKey throws for one model", async () => {
    getApiKeyMock
      .mockImplementationOnce(() => {
        throw new Error("secret configuration details");
      })
      .mockReturnValue("test-api-key");

    const response = await POST(makeRequest({
      prompt: VALID_BODY.prompt,
      modelIds: [VALID_MODEL, SECOND_MODEL],
    }));
    const body = await response.json() as {
      results: Array<{ imageUrl: string | null; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.results).toEqual([
      expect.objectContaining({ imageUrl: null, error: "Image generation is not configured" }),
      expect.objectContaining({ imageUrl: expect.any(String) }),
    ]);
    expect(JSON.stringify(consoleWarnMock.mock.calls)).not.toContain("secret configuration details");
  });

  it("fails before provider fan-out when Storage client initialization throws", async () => {
    getClientMock.mockImplementation(() => {
      throw new Error("secret client details");
    });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "IMAGE_STORAGE_UNAVAILABLE",
      message: "Image storage is unavailable",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getApiKeyMock).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleWarnMock.mock.calls)).not.toContain("secret client details");
  });

  it("fails before provider fan-out when the images bucket cannot be initialized", async () => {
    getClientMock.mockReturnValue({
      storage: {
        from: () => {
          throw new Error("secret bucket details");
        },
      },
    });

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string };

    expect(response.status).toBe(503);
    expect(body.error).toBe("IMAGE_STORAGE_UNAVAILABLE");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getApiKeyMock).not.toHaveBeenCalled();
    expect(JSON.stringify(consoleWarnMock.mock.calls)).not.toContain("secret bucket details");
  });

  it("keeps partial results when a Storage upload method throws", async () => {
    const storage = mockStorageClient();
    storage.uploadMock
      .mockRejectedValueOnce(new Error("secret upload details"))
      .mockResolvedValueOnce({ error: null });
    getClientMock.mockReturnValue(storage.client);

    const response = await POST(makeRequest({
      prompt: VALID_BODY.prompt,
      modelIds: [VALID_MODEL, SECOND_MODEL],
    }));
    const body = await response.json() as {
      results: Array<{ imageUrl: string | null; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.results.filter((result) => result.error === "Image storage is unavailable")).toHaveLength(1);
    expect(body.results.filter((result) => typeof result.imageUrl === "string")).toHaveLength(1);
    expect(getClientMock).toHaveBeenCalledOnce();
    expect(storage.fromMock).toHaveBeenCalledOnce();
    expect(JSON.stringify(consoleWarnMock.mock.calls)).not.toContain("secret upload details");
  });

  it("keeps partial results when getPublicUrl throws for one upload", async () => {
    const storage = mockStorageClient();
    storage.getPublicUrlMock
      .mockImplementationOnce(() => {
        throw new Error("secret public URL details");
      })
      .mockReturnValue({ data: { publicUrl: "https://storage.example/generated.png" } });
    getClientMock.mockReturnValue(storage.client);

    const response = await POST(makeRequest({
      prompt: VALID_BODY.prompt,
      modelIds: [VALID_MODEL, SECOND_MODEL],
    }));
    const body = await response.json() as {
      results: Array<{ imageUrl: string | null; error?: string }>;
    };

    expect(response.status).toBe(200);
    expect(body.results.filter((result) => result.error === "Image storage is unavailable")).toHaveLength(1);
    expect(body.results.filter((result) => typeof result.imageUrl === "string")).toHaveLength(1);
    expect(JSON.stringify(consoleWarnMock.mock.calls)).not.toContain("secret public URL details");
  });

  it("returns 503 before any paid provider call when Storage is not configured", async () => {
    getClientMock.mockReturnValue(null);

    const response = await POST(makeRequest(VALID_BODY));
    const body = await response.json() as { error?: string; message?: string };

    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: "IMAGE_STORAGE_UNAVAILABLE",
      message: "Image storage is not configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getApiKeyMock).not.toHaveBeenCalled();
  });

  it("returns a generic error and no image data when Storage upload fails", async () => {
    const rawBase64 = toBase64(PNG_BYTES);
    const storage = mockStorageClient("https://storage.example/unused.png", {
      message: "internal storage details",
    });
    getClientMock.mockReturnValue(storage.client);
    fetchMock.mockResolvedValue(mockOpenRouterSuccess({ b64Json: rawBase64 }));

    const response = await POST(makeRequest(VALID_BODY));
    const responseText = await response.text();
    const body = JSON.parse(responseText) as {
      results: Array<{ imageUrl: null; error: string }>;
    };

    expect(body.results[0]).toEqual(expect.objectContaining({
      imageUrl: null,
      error: "Image storage upload failed",
    }));
    expect(responseText).not.toContain(rawBase64);
    expect(responseText).not.toContain("internal storage details");
    expect(storage.getPublicUrlMock).not.toHaveBeenCalled();
  });

  it("uses the API key only in the provider Authorization header", async () => {
    const apiKey = "super-secret-openrouter-key";
    getApiKeyMock.mockReturnValue(apiKey);

    const response = await POST(makeRequest({
      ...VALID_BODY,
      providerUrl: "https://attacker.example/generate",
    }));
    const responseText = await response.text();
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];

    expect(url).toBe(OPENROUTER_IMAGE_API_URL);
    expect((options.headers as Record<string, string>).Authorization).toBe(`Bearer ${apiKey}`);
    expect(String(options.body)).not.toContain(apiKey);
    expect(responseText).not.toContain(apiKey);
    expect(responseText).not.toContain("attacker.example");
  });

  it("returns a controlled provider error and never logs an arbitrary provider message", async () => {
    const apiKey = "super-secret-openrouter-key";
    const arbitraryMessage = `invalid credential ${apiKey} prompt=${VALID_BODY.prompt}`;
    getApiKeyMock.mockReturnValue(apiKey);
    fetchMock.mockResolvedValue(mockOpenRouterError(401, arbitraryMessage, "AUTH_ERROR"));

    const response = await POST(makeRequest(VALID_BODY));
    const responseText = await response.text();
    const body = JSON.parse(responseText) as { results: Array<{ error: string }> };
    const warningText = JSON.stringify(consoleWarnMock.mock.calls);

    expect(body.results[0]?.error).toBe("Image provider request failed");
    expect(responseText).not.toContain(apiKey);
    expect(responseText).not.toContain(arbitraryMessage);
    expect(warningText).not.toContain(apiKey);
    expect(warningText).not.toContain(VALID_BODY.prompt);
    expect(warningText).not.toContain(arbitraryMessage);
    expect(warningText).not.toContain("AUTH_ERROR");
    expect(warningText).toContain("401");
  });
});
