import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSupabaseServerClient } from "./supabase";
import {
  DAILY_LIMITS,
  getDailyUsage,
  getUserLimit,
  getUserPlan,
  checkDailyLimit,
} from "./usage-limits";

vi.mock("./supabase", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetClient = vi.mocked(getSupabaseServerClient);

const USER_ID = "33333333-3333-4333-8333-333333333333";
const GUEST_ID = "44444444-4444-4444-8444-444444444444";

type ProfileRow = { role: string; plan: string } | null;

/**
 * Minimal chainable Supabase mock covering only the two tables these helpers
 * touch:
 *   tasks    -> select().gte().eq() resolves to { count }
 *   profiles -> select().eq().single() resolves to { data }
 */
function createSupabase(
  { taskCount = 0, profile = null }: { taskCount?: number; profile?: ProfileRow } = {}
) {
  const tasksQuery = {
    select: vi.fn(() => tasksQuery),
    gte: vi.fn(() => tasksQuery),
    eq: vi.fn(() => Promise.resolve({ count: taskCount })),
  };
  const profilesQuery = {
    select: vi.fn(() => profilesQuery),
    eq: vi.fn(() => profilesQuery),
    single: vi.fn(() => Promise.resolve({ data: profile })),
  };
  const client = {
    from: vi.fn((table: string) => (table === "profiles" ? profilesQuery : tasksQuery)),
  };
  return { client, tasksQuery, profilesQuery };
}

function asClient(client: unknown): ReturnType<typeof getSupabaseServerClient> {
  return client as unknown as ReturnType<typeof getSupabaseServerClient>;
}

beforeEach(() => {
  mockedGetClient.mockReset();
});

describe("getUserLimit", () => {
  it("returns the anonymous limit for any caller without a user id", async () => {
    expect(await getUserLimit(null, GUEST_ID)).toBe(DAILY_LIMITS.anonymous);
    expect(await getUserLimit(null, null)).toBe(DAILY_LIMITS.anonymous);
  });

  it("falls back to the free limit (never unlimited) when Supabase is unavailable", async () => {
    mockedGetClient.mockReturnValue(null);
    expect(await getUserLimit(USER_ID, null)).toBe(DAILY_LIMITS.free);
  });

  it("grants the admin limit only when the profile role is admin", async () => {
    const { client } = createSupabase({ profile: { role: "admin", plan: "free" } });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getUserLimit(USER_ID, null)).toBe(DAILY_LIMITS.admin);
  });

  it("maps a known plan to its configured limit", async () => {
    const { client } = createSupabase({ profile: { role: "user", plan: "pro" } });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getUserLimit(USER_ID, null)).toBe(DAILY_LIMITS.pro);
  });

  it("falls back to free for an unknown plan (dangerous fallback must not be unlimited)", async () => {
    const { client } = createSupabase({ profile: { role: "user", plan: "enterprise-spoofed" } });
    mockedGetClient.mockReturnValue(asClient(client));
    const limit = await getUserLimit(USER_ID, null);
    expect(limit).toBe(DAILY_LIMITS.free);
    expect(limit).toBeLessThan(DAILY_LIMITS.admin);
  });

  it("falls back to free when the profile row is missing", async () => {
    const { client } = createSupabase({ profile: null });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getUserLimit(USER_ID, null)).toBe(DAILY_LIMITS.free);
  });
});

describe("getUserPlan", () => {
  it("returns anonymous without a user id", async () => {
    expect(await getUserPlan(null)).toBe("anonymous");
  });

  it("returns free when Supabase is unavailable (no privilege escalation)", async () => {
    mockedGetClient.mockReturnValue(null);
    expect(await getUserPlan(USER_ID)).toBe("free");
  });

  it("returns admin only for an admin role", async () => {
    const { client } = createSupabase({ profile: { role: "admin", plan: "free" } });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getUserPlan(USER_ID)).toBe("admin");
  });

  it("returns a known plan as-is", async () => {
    const { client } = createSupabase({ profile: { role: "user", plan: "pro" } });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getUserPlan(USER_ID)).toBe("pro");
  });

  it("falls back to free for an unknown plan or a missing profile", async () => {
    const unknownPlan = createSupabase({ profile: { role: "user", plan: "spoofed" } });
    mockedGetClient.mockReturnValue(asClient(unknownPlan.client));
    expect(await getUserPlan(USER_ID)).toBe("free");

    const noProfile = createSupabase({ profile: null });
    mockedGetClient.mockReturnValue(asClient(noProfile.client));
    expect(await getUserPlan(USER_ID)).toBe("free");
  });
});

describe("getDailyUsage", () => {
  it("returns 0 when Supabase is unavailable", async () => {
    mockedGetClient.mockReturnValue(null);
    expect(await getDailyUsage(USER_ID, GUEST_ID)).toBe(0);
  });

  it("returns 0 when no identity is supplied", async () => {
    const { client } = createSupabase({ taskCount: 99 });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getDailyUsage(null, null)).toBe(0);
  });

  it("counts tasks for a user by user_id", async () => {
    const { client, tasksQuery } = createSupabase({ taskCount: 7 });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getDailyUsage(USER_ID, null)).toBe(7);
    expect(tasksQuery.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("counts tasks for a guest by anonymous_session_id", async () => {
    const { client, tasksQuery } = createSupabase({ taskCount: 2 });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await getDailyUsage(null, GUEST_ID)).toBe(2);
    expect(tasksQuery.eq).toHaveBeenCalledWith("anonymous_session_id", GUEST_ID);
  });
});

describe("checkDailyLimit", () => {
  it("allows when usage is below the limit", async () => {
    const { client } = createSupabase({ taskCount: 3, profile: { role: "user", plan: "free" } });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await checkDailyLimit(USER_ID, null)).toEqual({
      allowed: true,
      used: 3,
      limit: DAILY_LIMITS.free,
    });
  });

  it("blocks a guest once usage reaches the anonymous limit (boundary)", async () => {
    const { client } = createSupabase({ taskCount: DAILY_LIMITS.anonymous });
    mockedGetClient.mockReturnValue(asClient(client));
    expect(await checkDailyLimit(null, GUEST_ID)).toEqual({
      allowed: false,
      used: DAILY_LIMITS.anonymous,
      limit: DAILY_LIMITS.anonymous,
    });
  });

  it("keeps a finite limit in degraded mode (no unlimited access)", async () => {
    mockedGetClient.mockReturnValue(null);
    const result = await checkDailyLimit(USER_ID, null);
    expect(result.limit).toBe(DAILY_LIMITS.free);
    expect(Number.isFinite(result.limit)).toBe(true);
  });
});
