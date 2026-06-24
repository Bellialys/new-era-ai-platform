"use client";

import { useState, useEffect } from "react";

export const dynamic = "force-dynamic";

type AuditEntry = {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function payloadSummary(payload: Record<string, unknown> | null): string {
  if (!payload) return "—";
  try {
    return JSON.stringify(payload).slice(0, 120);
  } catch {
    return "—";
  }
}

function ActionBadge({ action }: { action: string }) {
  const color =
    action.includes("role") ? "border-violet-500/30 bg-violet-500/10 text-violet-300" :
    action.includes("plan") ? "border-blue-500/30 bg-blue-500/10 text-blue-300" :
    action.includes("model") ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
    "border-white/10 bg-white/5 text-slate-300";
  return (
    <span className={`rounded-md border px-2 py-0.5 font-mono text-xs ${color}`}>
      {action}
    </span>
  );
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((data: { entries?: AuditEntry[] }) => {
        if (cancelled) return;
        if (data.entries) setEntries(data.entries);
        else setError("Не удалось загрузить аудит");
      })
      .catch(() => {
        if (!cancelled) setError("Ошибка при загрузке");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-black text-white">Аудит</h1>
      <p className="mt-1 text-sm text-slate-400">
        {loading ? "Загрузка..." : `${entries.length} последних событий`}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Загрузка...</div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Событий не найдено</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Время</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Актор</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Действие</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Цель</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {entries.map((entry) => (
                  <tr key={entry.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-5 py-4 text-xs tabular-nums text-slate-400">
                      {formatDateTime(entry.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-white">{entry.actorName ?? <span className="text-slate-500">—</span>}</p>
                      {entry.actorId && (
                        <p className="mt-0.5 font-mono text-xs text-slate-600">{entry.actorId.slice(0, 8)}…</p>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <ActionBadge action={entry.action} />
                    </td>
                    <td className="px-5 py-4">
                      {entry.targetType && (
                        <span className="text-xs text-slate-400">
                          {entry.targetType}
                          {entry.targetId ? `: ${entry.targetId.slice(0, 8)}…` : ""}
                        </span>
                      )}
                    </td>
                    <td className="max-w-xs px-5 py-4">
                      <p className="truncate font-mono text-xs text-slate-500">
                        {payloadSummary(entry.payload)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
