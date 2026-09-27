import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { NextRequest, NextResponse } from "next/server";

const {
  getUserMock,
  getSupabaseServerClientMock,
  guestFromMock,
  guestSelectMock,
  guestEqMock,
  guestMaybeSingleMock,
} = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  getSupabaseServerClientMock: vi.fn(),
  guestFromMock: vi.fn(),
  guestSelectMock: vi.fn(),
  guestEqMock: vi.fn(),
  guestMaybeSingleMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));

vi.mock("./supabase", () => ({
  getSupabaseServerClient: getSupabaseServerClientMock,
}));

import {
  readGuestSessionId,
  applyGuestCookie,
  getAuthenticatedUserId,
  resolveRequestIdentity,
} from "./auth";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const VALID_GUEST = "44444444-4444-4444-8444-444444444444";

const guestQuery = {
  select: guestSelectMock,
  eq: guestEqMock,
  maybeSingle: guestMaybeSingleMock,
};

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
  getSupabaseServerClientMock.mockReset();
  guestFromMock.mockReset();
  guestSelectMock.mockReset();
  guestEqMock.mockReset();
  guestMaybeSingleMock.mockReset();

  guestFromMock.mockReturnValue(guestQuery);
  guestSelectMock.mockReturnValue(guestQuery);
  guestEqMock.mockReturnValue(guestQuery);
  guestMaybeSingleMock.mockResolvedValue({ data: { id: VALID_GUEST }, error: null });
  getSupabaseServerClientMock.mockReturnValue({ from: guestFromMock });

  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

afterEach(() => {
  vi.unstubAllEnvs();
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
    expect(guestFromMock).toHaveBeenCalledWith("anonymous_sessions");
    expect(guestEqMock).toHaveBeenCalledWith("id", VALID_GUEST);
  });

  it("rejects a well-formed guest UUID that does not exist in anonymous_sessions", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    guestMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));

    expect(identity).toEqual({ kind: "none", userId: null, guestId: null });
  });

  it("fails closed when guest-session verification throws", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    guestMaybeSingleMock.mockRejectedValue(new Error("database unavailable"));

    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));

    expect(identity).toEqual({ kind: "none", userId: null, guestId: null });
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

  it("still resolves a guest in local/test mode when persistence is unconfigured", async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    getSupabaseServerClientMock.mockReturnValue(null);
    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));
    expect(identity).toEqual({ kind: "guest", userId: null, guestId: VALID_GUEST });
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("rejects an unverifiable guest in production when persistence is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const key of ENV_KEYS) delete process.env[key];
    getSupabaseServerClientMock.mockReturnValue(null);

    const identity = await resolveRequestIdentity(mockRequest({ na_guest: VALID_GUEST }));

    expect(identity).toEqual({ kind: "none", userId: null, guestId: null });
  });
});
