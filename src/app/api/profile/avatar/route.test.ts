import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  getAuthenticatedUserIdMock,
  checkRateLimitMock,
  storageUploadMock,
  storageRemoveMock,
  storageSignedUrlMock,
  profilesUpdateEqMock,
} = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  storageUploadMock: vi.fn(),
  storageRemoveMock: vi.fn(),
  storageSignedUrlMock: vi.fn(),
  profilesUpdateEqMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getAuthenticatedUserId: getAuthenticatedUserIdMock,
    checkRateLimit: checkRateLimitMock,
    logApiRequest: vi.fn(),
  };
});

vi.mock("@/lib/server/supabase", () => ({
  getSupabaseServerClient: () => ({
    storage: {
      from: () => ({
        upload: storageUploadMock,
        remove: storageRemoveMock,
        createSignedUrl: storageSignedUrlMock,
      }),
    },
    from: () => ({
      update: () => ({ eq: profilesUpdateEqMock }),
    }),
  }),
}));

import { POST, DELETE } from "./route";
import {
  AVATAR_RATE_LIMIT_MAX_REQUESTS,
  AVATAR_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const NOT_LIMITED = {
  limited: false,
  remaining: AVATAR_RATE_LIMIT_MAX_REQUESTS - 1,
  resetAt: Date.now() + AVATAR_RATE_LIMIT_WINDOW_MS,
};

const LIMITED = {
  limited: true,
  remaining: 0,
  resetAt: Date.now() + AVATAR_RATE_LIMIT_WINDOW_MS,
};

function makeUploadRequest(mime = "image/webp"): NextRequest {
  const formData = new FormData();
  const file = new File([new Uint8Array([1, 2, 3])], `avatar.${mime.split("/")[1]}`, {
    type: mime,
  });
  formData.append("file", file);
  return new NextRequest("http://localhost/api/profile/avatar", {
    method: "POST",
    body: formData,
  });
}

function makeDeleteRequest(): NextRequest {
  return new NextRequest("http://localhost/api/profile/avatar", { method: "DELETE" });
}

beforeEach(() => {
  getAuthenticatedUserIdMock.mockReset();
  checkRateLimitMock.mockReset();
  storageUploadMock.mockReset();
  storageRemoveMock.mockReset();
  storageSignedUrlMock.mockReset();
  profilesUpdateEqMock.mockReset();

  getAuthenticatedUserIdMock.mockResolvedValue(USER_ID);
  checkRateLimitMock.mockResolvedValue(NOT_LIMITED);
  storageUploadMock.mockResolvedValue({ error: null });
  storageRemoveMock.mockResolvedValue({ data: [], error: null });
  storageSignedUrlMock.mockResolvedValue({
    data: { signedUrl: "https://stub.supabase.co/signed/avatar.webp" },
    error: null,
  });
  profilesUpdateEqMock.mockResolvedValue({ error: null });
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/profile/avatar — auth", () => {
  it("returns 401 when there is no authenticated user", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue(null);

    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

describe("POST /api/profile/avatar — rate limit", () => {
  it("returns 429 with Retry-After and never touches storage when limited", async () => {
    checkRateLimitMock.mockResolvedValue(LIMITED);

    const res = await POST(makeUploadRequest());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(storageUploadMock).not.toHaveBeenCalled();
  });

  it("uses a per-user key with the avatar constants", async () => {
    await POST(makeUploadRequest());

    expect(checkRateLimitMock).toHaveBeenCalledWith(
      `avatar:user:${USER_ID}`,
      AVATAR_RATE_LIMIT_MAX_REQUESTS,
      AVATAR_RATE_LIMIT_WINDOW_MS
    );
  });
});

describe("DELETE /api/profile/avatar — rate limit", () => {
  it("returns 429 with Retry-After and never touches storage when limited", async () => {
    checkRateLimitMock.mockResolvedValue(LIMITED);

    const res = await DELETE(makeDeleteRequest());

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.errorCode).toBe("RATE_LIMIT");
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
    expect(storageRemoveMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Stale extension cleanup
// ---------------------------------------------------------------------------

describe("POST /api/profile/avatar — stale extension cleanup", () => {
  it("removes the other two extension variants after a webp upload", async () => {
    const res = await POST(makeUploadRequest("image/webp"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
    expect(storageRemoveMock).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemoveMock.mock.calls[0][0] as string[];
    expect(removedPaths.sort()).toEqual(
      [`${USER_ID}/avatar.jpg`, `${USER_ID}/avatar.png`].sort()
    );
  });

  it("keeps the upload successful even if cleanup rejects", async () => {
    storageRemoveMock.mockRejectedValue(new Error("network hiccup"));

    const res = await POST(makeUploadRequest("image/jpeg"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("success");
  });
});
