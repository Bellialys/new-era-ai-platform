import { NextRequest, NextResponse } from "next/server";
import { resolveRequestIdentity, logApiRequest } from "@/lib/server";
import { checkDailyLimit, getUserPlan } from "@/lib/server/usage-limits";

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const identity = await resolveRequestIdentity(request);

  if (identity.kind === "none") {
    logApiRequest("GET", "/api/usage", 401, Date.now() - startTime);
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const [limitCheck, plan] = await Promise.all([
    checkDailyLimit(identity.userId, identity.guestId),
    getUserPlan(identity.userId),
  ]);

  logApiRequest("GET", "/api/usage", 200, Date.now() - startTime);
  return NextResponse.json({
    used: limitCheck.used,
    limit: limitCheck.limit,
    plan,
  });
}
