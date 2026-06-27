import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Hoist mocks so they are available before module imports are evaluated.
const { getUserMock, cookiesMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: getUserMock } })),
}));
vi.mock("./supabase", () => ({ getSupabaseServerClient: vi.fn() }));

import { requireAdmin } from "./admin";
import { getSupabaseServerClient } from "./supabase";

const mockedGetClient = vi.mocked(getSupabaseServerClient);

const ADMIN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// Supabase config env vars read by readPublicSupabaseConfig() inside admin.ts
const ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const;
const savedEnv: Record<string, string | undefined> = {};

/** Chainable mock that resolves .select().eq().single() with a profile row or error. */
function makeProfileClient(
  profile: { role: string } | null,
  error: unknown = null
) {
  const query = {
    select: vi.fn(function () { return query; }),
    eq: vi.fn(function () { return query; }),
    single: vi.fn(() => Promise.resolve({ data: profile, error })),
  };
  return { from: vi.fn(() => query) } as unknown as ReturnType<typeof getSupabaseServerClient>;
}

beforeEach(() => {
  getUserMock.mockReset();
  mockedGetClient.mockReset();

  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Default: cookies() returns an empty, valid cookie store.
  cookiesMock.mockResolvedValue({ getAll: () => [] });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

// ---------------------------------------------------------------------------
// Security invariant: every non-admin path must throw 403 FORBIDDEN.
// ---------------------------------------------------------------------------

describe("requireAdmin — access denied paths", () => {
  it("throws 403 immediately when Supabase config env vars are absent", async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
    // No Supabase call should have been made.
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("throws 403 when auth.getUser returns an error (invalid/expired token)", async () => {
    getUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 when auth.getUser returns no user (unauthenticated)", async () => {
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 500 when the service client is unavailable (DB not configured)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(null);

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 500,
      errorCode: "INTERNAL_ERROR",
    });
  });

  it("throws 403 (fail-closed) when the profile DB lookup returns an error", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(
      makeProfileClient(null, { code: "PGRST116", message: "no rows found" })
    );

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 when the profile row is missing (user has no profile)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient(null));

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 when role is 'user' (regular authenticated user)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "user" }));

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 when role is an unknown/spoofed value", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "superadmin-spoofed" }));

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 for 'Admin' — role check is case-sensitive (no spoofing via casing)", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "Admin" }));

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });

  it("throws 403 for empty string role", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "" }));

    await expect(requireAdmin()).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "FORBIDDEN",
    });
  });
});

// ---------------------------------------------------------------------------
// Security invariant: the only passing case.
// ---------------------------------------------------------------------------

describe("requireAdmin — access granted", () => {
  it("returns { userId } when role is exactly 'admin'", async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: ADMIN_ID } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "admin" }));

    const result = await requireAdmin();

    expect(result).toEqual({ userId: ADMIN_ID });
  });

  it("returns the correct userId from the verified session (not from a request body)", async () => {
    const sessionUserId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    getUserMock.mockResolvedValue({ data: { user: { id: sessionUserId } }, error: null });
    mockedGetClient.mockReturnValue(makeProfileClient({ role: "admin" }));

    const result = await requireAdmin();

    expect(result.userId).toBe(sessionUserId);
  });
});
