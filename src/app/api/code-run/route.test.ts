import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks so they exist before any module import is evaluated.
// ---------------------------------------------------------------------------

const { resolveIdentityMock, checkRateLimitMock } = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: vi.fn(),
  };
});

// Stub global fetch — the route must never make real HTTP calls in tests.
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { POST } from "./route";
import { PISTON_API_URL, CODE_RUN_MAX_CHARS } from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const VALID_BODY = { language: "python", code: 'print("hello")' };

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/code-run", { method: "POST" });
  }
  return new NextRequest("http://localhost/api/code-run", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function mockRunner(
  data: unknown,
  opts: { ok?: boolean; throwOnJson?: boolean } = {}
): Response {
  return {
    ok: opts.ok ?? true,
    status: opts.ok === false ? 500 : 200,
    json: opts.throwOnJson
      ? () => { throw new SyntaxError("Unexpected token"); }
      : () => Promise.resolve(data),
  } as unknown as Response;
}

function makePistonData(overrides?: {
  stdout?: string;
  stderr?: string;
  code?: number;
  cpu_time?: number;
}) {
  return {
    language: "python",
    version: "3.10.0",
    run: {
      stdout: "hello",
      stderr: "",
      code: 0,
      cpu_time: 10,
      output: "hello",
      ...overrides,
    },
  };
}

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  fetchMock.mockReset();

  // Happy-path defaults: authenticated user, not rate-limited, runner succeeds.
  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue({ limited: false, remaining: 9, resetAt: Date.now() + 60_000 });
  fetchMock.mockResolvedValue(mockRunner(makePistonData()));
});

// ---------------------------------------------------------------------------
// Identity — only authenticated users may run code
// ---------------------------------------------------------------------------

describe("POST /api/code-run — identity check", () => {
  it("returns 401 when the caller has no identity (unauthenticated)", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    // Rate limit and runner must not be reached.
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the caller is a guest (code execution requires authentication)", async () => {
    resolveIdentityMock.mockResolvedValue({
      kind: "guest",
      userId: null,
      guestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(401);
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/code-run — rate limiting", () => {
  it("returns 429 with Retry-After header when the per-user rate limit is exceeded", async () => {
    const resetAt = Date.now() + 30_000;
    checkRateLimitMock.mockResolvedValue({ limited: true, remaining: 0, resetAt });

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(429);
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scopes the rate limit key to the authenticated session userId, not to request body fields", async () => {
    await POST(makeRequest({ ...VALID_BODY, userId: "attacker-id" }));

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `code-run:user:${USER_ID}`,
      expect.any(Number),
      expect.any(Number)
    );
  });
});

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

describe("POST /api/code-run — request validation", () => {
  it("returns 400 INVALID_JSON when the body is not valid JSON", async () => {
    const res = await POST(makeRequest("this is not json"));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("INVALID_JSON");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when language is missing from the body", async () => {
    const res = await POST(makeRequest({ code: 'print("hi")' }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR for an unrecognised language value", async () => {
    const res = await POST(makeRequest({ language: "brainfuck", code: "+++" }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects language values with wrong casing (language check is case-sensitive)", async () => {
    // "Python" is not in ALLOWED_LANGUAGES ("python" is).
    const res = await POST(makeRequest({ language: "Python", code: 'print("hi")' }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when code is an empty string", async () => {
    const res = await POST(makeRequest({ language: "python", code: "" }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when code exceeds CODE_RUN_MAX_CHARS", async () => {
    const oversized = "x".repeat(CODE_RUN_MAX_CHARS + 1);
    const res = await POST(makeRequest({ language: "python", code: oversized }));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(400);
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// External runner — happy and error paths
// ---------------------------------------------------------------------------

describe("POST /api/code-run — external runner", () => {
  it("returns 200 with stdout, stderr, exitCode, cpuTime, and language on success", async () => {
    fetchMock.mockResolvedValue(
      mockRunner(makePistonData({ stdout: "output\n", stderr: "", code: 0, cpu_time: 42 }))
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as {
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      cpuTime?: number;
      language?: string;
    };

    expect(res.status).toBe(200);
    expect(body.stdout).toBe("output\n");
    expect(body.stderr).toBe("");
    expect(body.exitCode).toBe(0);
    expect(body.cpuTime).toBe(42);
    expect(body.language).toBe("python");
  });

  it("returns 502 PISTON_ERROR when the runner responds with a non-OK status", async () => {
    fetchMock.mockResolvedValue(mockRunner({ error: "runtime crash" }, { ok: false }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(502);
    expect(body.errorCode).toBe("PISTON_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when fetch rejects (network failure or timeout)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });

  it("returns 500 INTERNAL_ERROR when the runner response is malformed JSON", async () => {
    fetchMock.mockResolvedValue(mockRunner(null, { throwOnJson: true }));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
  });

  it("truncates stdout and stderr to 5000 characters each (DoS mitigation)", async () => {
    const longOut = "a".repeat(6000);
    const longErr = "e".repeat(7000);
    fetchMock.mockResolvedValue(
      mockRunner(makePistonData({ stdout: longOut, stderr: longErr }))
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { stdout?: string; stderr?: string };

    expect(res.status).toBe(200);
    expect(body.stdout?.length).toBe(5000);
    expect(body.stderr?.length).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// Security assertions
// ---------------------------------------------------------------------------

describe("POST /api/code-run — security", () => {
  it("calls the runner at the hardcoded PISTON_API_URL, not at a URL from the request body", async () => {
    // Attacker includes a 'runnerUrl' field — it must be ignored.
    await POST(makeRequest({ ...VALID_BODY, runnerUrl: "http://evil.example/exec" }));

    expect(fetchMock).toHaveBeenCalledWith(
      PISTON_API_URL,
      expect.objectContaining({ method: "POST" })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "http://evil.example/exec",
      expect.anything()
    );
  });

  it("user code reaches the external runner and is not executed server-side", async () => {
    // The stdout value comes from the mocked fetch response, not from local eval.
    fetchMock.mockResolvedValue(
      mockRunner(makePistonData({ stdout: "runner-output-sentinel" }))
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { stdout?: string };

    expect(res.status).toBe(200);
    expect(body.stdout).toBe("runner-output-sentinel");
    // Exactly one outbound call was made — to the external runner.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("error responses do not contain a stack trace or raw error internals", async () => {
    fetchMock.mockRejectedValue(new Error("internal db dsn leaked"));

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as Record<string, unknown>;

    expect(res.status).toBe(500);
    expect(body.errorCode).toBe("INTERNAL_ERROR");
    expect(body).not.toHaveProperty("stack");
    expect(JSON.stringify(body)).not.toContain("internal db dsn leaked");
  });

  it("accepts all 7 supported languages and rejects anything else", async () => {
    const supported = ["javascript", "typescript", "python", "go", "rust", "cpp", "java"];

    for (const lang of supported) {
      resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
      checkRateLimitMock.mockResolvedValue({ limited: false, remaining: 9, resetAt: Date.now() + 60_000 });
      fetchMock.mockResolvedValue(mockRunner(makePistonData()));

      const res = await POST(makeRequest({ language: lang, code: "// code" }));
      expect(res.status).toBe(200);
    }

    // Something outside the allow-list is rejected without reaching the runner.
    fetchMock.mockReset();
    const rejected = await POST(makeRequest({ language: "bash", code: "echo hi" }));
    expect(rejected.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
