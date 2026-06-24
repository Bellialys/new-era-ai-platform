import { getSupabaseServerClient } from "./supabase";

export const DAILY_LIMITS = {
  anonymous: 5,
  free: 20,
  pro: 100,
  admin: 9999,
} as const;

export type UserPlan = keyof typeof DAILY_LIMITS;

export async function getDailyUsage(
  userId: string | null,
  guestId: string | null
): Promise<number> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return 0;

  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  let query = supabase
    .from("tasks")
    .select("*", { count: "exact", head: true })
    .gte("created_at", todayUtc.toISOString());

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (guestId) {
    query = query.eq("anonymous_session_id", guestId);
  } else {
    return 0;
  }

  const { count } = await query;
  return count ?? 0;
}

export async function getUserLimit(
  userId: string | null,
  _guestId: string | null
): Promise<number> {
  if (!userId) {
    return DAILY_LIMITS.anonymous;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return DAILY_LIMITS.free;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan")
    .eq("id", userId)
    .single();

  if (!profile) return DAILY_LIMITS.free;

  const row = profile as { role: string; plan: string };
  if (row.role === "admin") return DAILY_LIMITS.admin;

  const plan = row.plan as UserPlan;
  return DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;
}

export async function getUserPlan(userId: string | null): Promise<UserPlan> {
  if (!userId) return "anonymous";

  const supabase = getSupabaseServerClient();
  if (!supabase) return "free";

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, plan")
    .eq("id", userId)
    .single();

  if (!profile) return "free";

  const row = profile as { role: string; plan: string };
  if (row.role === "admin") return "admin";

  const plan = row.plan as UserPlan;
  return (plan in DAILY_LIMITS ? plan : "free") as UserPlan;
}

export async function checkDailyLimit(
  userId: string | null,
  guestId: string | null
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const [used, limit] = await Promise.all([
    getDailyUsage(userId, guestId),
    getUserLimit(userId, guestId),
  ]);

  return { allowed: used < limit, used, limit };
}
