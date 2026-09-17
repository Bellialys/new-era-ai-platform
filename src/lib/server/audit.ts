import { getSupabaseServerClient } from "./supabase";

export async function logAuditEvent(opts: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseServerClient();
  if (!supabase) throw new Error("Audit log is unavailable.");

  const { error } = await supabase.from("audit_log").insert({
    actor_id: opts.actorId,
    action: opts.action,
    target_type: opts.targetType ?? null,
    target_id: opts.targetId ?? null,
    payload: opts.payload ?? null,
  });

  if (error) {
    console.error("audit_log insert failed:", error.code ?? "unknown");
    throw new Error("Audit log insert failed.");
  }
}
