"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

type UsageRow = {
  userId: string;
  displayName: string | null;
  plan: string;
  requestsToday: number;
  requestsWeek: number;
};

const PLAN_LIMITS: Record<string, number> = {
  anonymous: 5,
  free: 20,
  pro: 100,
  admin: 9999,
};

function limitForPlan(plan: string): number {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.free ?? 20;
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-red-400" : pct >= 80 ? "bg-amber-300" : "bg-cyan-300";
  return (
    <div className="h-2 w-28 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/usage")
      .then((r) => r.json())
      .then((data: { users?: UsageRow[] }) => {
        if (cancelled) return;
        if (data.users) setRows(data.users);
        else setError("Не удалось загрузить данные");
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

  const stats = useMemo(() => {
    const today = rows.reduce((sum, row) => sum + row.requestsToday, 0);
    const week = rows.reduce((sum, row) => sum + row.requestsWeek, 0);
    const nearLimit = rows.filter((row) => row.requestsToday >= limitForPlan(row.plan) * 0.8).length;
    return { activeUsers: rows.length, nearLimit, today, week };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => {
        const matchesQuery =
          query.length === 0 ||
          row.displayName?.toLowerCase().includes(query) ||
          row.userId.toLowerCase().includes(query);
        const matchesPlan = planFilter === "all" || row.plan === planFilter;
        return matchesQuery && matchesPlan;
      })
      .sort((a, b) => b.requestsToday - a.requestsToday);
  }, [planFilter, rows, search]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-200/10 bg-white/[0.055] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">Usage control</p>
            <h1 className="mt-2 text-3xl font-black text-white">Использование</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Контроль лимитов и активности пользователей за сегодня и неделю.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[30rem]">
            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-3">
              <p className="text-xl font-black text-white">{stats.activeUsers}</p>
              <p className="text-[11px] text-cyan-100/60">активных</p>
            </div>
            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-3">
              <p className="text-xl font-black text-cyan-100">{stats.today}</p>
              <p className="text-[11px] text-cyan-100/60">сегодня</p>
            </div>
            <div className="rounded-2xl border border-violet-200/10 bg-violet-300/[0.08] px-3 py-3">
              <p className="text-xl font-black text-violet-100">{stats.week}</p>
              <p className="text-[11px] text-violet-100/60">неделя</p>
            </div>
            <div className="rounded-2xl border border-amber-200/10 bg-amber-300/[0.08] px-3 py-3">
              <p className="text-xl font-black text-amber-100">{stats.nearLimit}</p>
              <p className="text-[11px] text-amber-100/60">у лимита</p>
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
            placeholder="Поиск по имени или user id"
            className="min-h-11 w-full rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40 xl:max-w-md"
          />
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="rounded-full border border-cyan-200/10 bg-[#0b1930] px-3 py-1.5 text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-300/40"
          >
            <option value="all">Любой тариф</option>
            <option value="anonymous">anonymous</option>
            <option value="free">free</option>
            <option value="pro">pro</option>
            <option value="admin">admin</option>
          </select>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20">
          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Загрузка использования...</div>
          ) : filteredRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Нет активных пользователей по выбранным фильтрам</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-cyan-200/10 bg-cyan-200/[0.035]">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Пользователь</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Тариф</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Сегодня</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-cyan-100/55">За неделю</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/[0.08]">
                  {filteredRows.map((row) => {
                    const limit = limitForPlan(row.plan);
                    const warning = row.requestsToday >= limit ? "text-red-300" : row.requestsToday >= limit * 0.8 ? "text-amber-200" : "text-cyan-50";
                    return (
                      <tr key={row.userId} className="transition hover:bg-cyan-200/[0.04]">
                        <td className="px-5 py-4">
                          <p className="text-sm font-semibold text-white">
                            {row.displayName ?? <span className="text-slate-500">Без имени</span>}
                          </p>
                          <p className="mt-1 font-mono text-xs text-cyan-100/35">{row.userId.slice(0, 8)}…</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-1 text-xs font-semibold text-cyan-50">
                            {row.plan}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <span className={`text-sm font-semibold tabular-nums ${warning}`}>{row.requestsToday} / {limit}</span>
                            <ProgressBar value={row.requestsToday} max={limit} />
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-sm font-semibold tabular-nums text-cyan-50/85">{row.requestsWeek}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
