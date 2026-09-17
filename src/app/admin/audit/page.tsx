"use client";

import { useEffect, useMemo, useState } from "react";

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
    return JSON.stringify(payload).slice(0, 140);
  } catch {
    return "—";
  }
}

function ActionBadge({ action }: { action: string }) {
  const color = action.includes("role")
    ? "border-violet-300/30 bg-violet-300/10 text-violet-100"
    : action.includes("plan")
      ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
      : action.includes("model")
        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
        : "border-white/10 bg-white/[0.05] text-slate-300";
  return <span className={`rounded-full border px-2.5 py-1 font-mono text-xs ${color}`}>{action}</span>;
}

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

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
    return () => {
      cancelled = true;
    };
  }, []);

  const actionGroups = useMemo(() => {
    const uniqueActions = Array.from(new Set(entries.map((entry) => entry.action))).sort();
    return uniqueActions.slice(0, 12);
  }, [entries]);

  const stats = useMemo(() => {
    return {
      model: entries.filter((entry) => entry.action.includes("model")).length,
      role: entries.filter((entry) => entry.action.includes("role")).length,
      total: entries.length,
      user: entries.filter((entry) => entry.action.includes("plan") || entry.action.includes("role")).length,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const payload = payloadSummary(entry.payload).toLowerCase();
      const matchesQuery =
        query.length === 0 ||
        entry.action.toLowerCase().includes(query) ||
        entry.actorName?.toLowerCase().includes(query) ||
        entry.actorId?.toLowerCase().includes(query) ||
        entry.targetType?.toLowerCase().includes(query) ||
        entry.targetId?.toLowerCase().includes(query) ||
        payload.includes(query);
      const matchesAction = actionFilter === "all" || entry.action === actionFilter;
      return matchesQuery && matchesAction;
    });
  }, [actionFilter, entries, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-200/10 bg-white/[0.055] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">Audit trail</p>
            <h1 className="mt-2 text-3xl font-black text-white">Аудит</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              История административных действий: роли, тарифы, модели и полезная нагрузка события.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[28rem]">
            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-3">
              <p className="text-xl font-black text-white">{stats.total}</p>
              <p className="text-[11px] text-cyan-100/60">всего</p>
            </div>
            <div className="rounded-2xl border border-violet-200/10 bg-violet-300/[0.08] px-3 py-3">
              <p className="text-xl font-black text-violet-100">{stats.role}</p>
              <p className="text-[11px] text-violet-100/60">role</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/10 bg-emerald-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-emerald-100">{stats.model}</p>
              <p className="text-[11px] text-emerald-100/60">model</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-200/10 bg-fuchsia-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-fuchsia-100">{stats.user}</p>
              <p className="text-[11px] text-fuchsia-100/60">user ops</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-cyan-200/10 bg-[#071427]/70 p-5 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по actor, action, target или payload"
            className="min-h-11 w-full rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40 xl:max-w-md"
          />
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded-full border border-cyan-200/10 bg-[#0b1930] px-3 py-1.5 text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-300/40"
          >
            <option value="all">Любое действие</option>
            {actionGroups.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20">
          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Загрузка аудита...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Событий не найдено по выбранным фильтрам</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px]">
                <thead>
                  <tr className="border-b border-cyan-200/10 bg-cyan-200/[0.035]">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Время</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Актор</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Действие</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Цель</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/[0.08]">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="transition hover:bg-cyan-200/[0.04]">
                      <td className="px-5 py-4 text-xs tabular-nums text-cyan-50/70">{formatDateTime(entry.createdAt)}</td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-white">{entry.actorName ?? <span className="text-slate-500">—</span>}</p>
                        {entry.actorId && <p className="mt-1 font-mono text-xs text-cyan-100/30">{entry.actorId.slice(0, 8)}…</p>}
                      </td>
                      <td className="px-5 py-4"><ActionBadge action={entry.action} /></td>
                      <td className="px-5 py-4">
                        {entry.targetType ? (
                          <span className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.05] px-2.5 py-1 text-xs text-cyan-50/80">
                            {entry.targetType}{entry.targetId ? `: ${entry.targetId.slice(0, 8)}…` : ""}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </td>
                      <td className="max-w-sm px-5 py-4">
                        <p className="truncate font-mono text-xs text-cyan-100/35">{payloadSummary(entry.payload)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
