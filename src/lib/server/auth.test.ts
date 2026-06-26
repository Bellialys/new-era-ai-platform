import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest, NextResponse } from "next/server";

const { getUserMock } = vi.hoisted(() => ({ getUserMock: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

import {
  readGuestSessionId,
  ensureGuestSessionId,
  applyGuestCookie,
  getAuthenticatedUserId,
  resolveRequestIdentity,
} from "./auth";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_GUEST = "44444444-4444-4444-8444-444444444444";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Minimal NextRequest stub exposing only the cookie API these helpers use. */
function mockRequest(cookies: Record<string, string> = {}): NextRequest {
  return {
    cookies: {
      get(name: string) {
        return name in cookies ? { name, value: cookies[name] } : undefined;
      },
      getAll() {
        return Object.entries(cookies).map(([name, value]) => ({ name, value }));
      },
    },
  } as unknown as NextRequest;
}

/** Minimal NextResponse stub capturing cookies.set calls. */
function mockResponse() {
  const set = vi.fn();
  const response = { cookies: { set } } as unknown as NextResponse;
  return { response, set };
}

const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;

const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  getUserMock.mockReset();
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe("readGuestSessionId", () => {
  it("returns a well-formed guest id from the cookie", () => {
    expect(readGuestSessionId(mockRequest({ na_guest: VALID_GUEST }))).toBe(VALID_GUEST);
  });

  it("rejects a malformed guest id", () => {
    expect(readGuestSessionId(mockRequest({ na_guest: "not-a-uuid" }))).toBeNull();
  });

  it("returns null when the cookie is absent", () => {
    expect(readGuestSessionId(mockRequest())).toBeNull();
  });
});

describe("ensureGuestSessionId", () => {
  it("reuses an existing valid guest id (stable across calls)", () => {
    const request = mockRequest({ na_guest: VALID_GUEST });
    expect(ensureGuestSessionId(request)).toBe(VALID_GUEST);
    expect(ensureGuestSessionId(request)).toBe(VALID_GUEST);
  });

  it("mints a fresh uuid when no cookie is present", () => {
    expect(ensureGuestSessionId(mockRequest())).toMatch(UUID_RE);
  });

  it("never reuses a malformed cookie value", () => {
    const minted = ensureGuestSessionId(mockRequest({ na_guest: "spoofed" }));
    expect(minted).not.toBe("spoofed");
    expect(minted).toMatch(UUID_RE);
  });
});

describe("applyGuestCookie", () => {
  it("sets the guest cookie httpOnly and SameSite=Lax", () => {
    const { response, set } = mockResponse();
    applyGuestCookie(response, VALID_GUEST);
    expect(set).toHaveBeenCalledWith(
      "na_guest",
      VALID_GUEST,
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/" })
    );
  });
});

describe("getAuthenticatedUserId", () => {
  it("returns null without ever calling Supabase when config is missing", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    expect(await getAuthenticatedUserId(mockRequest())).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("returns the verified user id", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    expect(await getAuthenticatedUserId(mockRequest())).toBe(USER_ID);
  });

  it("returns null when Supabase reports an error", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: { message: "invalid token" } });
    expect(await getAuthenticatedUserId(mockRequest())).toBeNull();
  });

  it("returns null (not a throw) when the auth client rejects", async () => {
    getUserMock.mockRejectedValue(new Error("network down"));
    expect(await getAuthenticatedUserId(mockRequest())).toBeNull();
  });
});

describe("resolveRequestIdentity", () => {
  it("resolves a verified user, and a guest cookie never downgrades it", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null });
    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));
    expect(identity).toEqual({ kind: "user", userId: USER_ID, guestId: null });
  });

  it("resolves an existing guest when there is no user", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));
    expect(identity).toEqual({ kind: "guest", userId: null, guestId: VALID_GUEST });
  });

  it("resolves to none (no auto-minted guest) when nothing identifies the caller", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const identity = await resolveRequestIdentity(mockRequest());
    expect(identity).toEqual({ kind: "none", userId: null, guestId: null });
  });

  it("treats a malformed guest cookie as no identity", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const identity = await resolveRequestIdentity(mockRequest({ na_guest: "spoofed" }));
    expect(identity.kind).toBe("none");
  });

  it("still resolves a guest when Supabase is unconfigured", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));
    expect(identity).toEqual({ kind: "guest", userId: null, guestId: VALID_GUEST });
    expect(getUserMock).not.toHaveBeenCalled();
  });
});
