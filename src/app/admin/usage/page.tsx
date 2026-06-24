"use client";

import { useState, useEffect } from "react";
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
  const color =
    pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function AdminUsagePage() {
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-black text-white">Использование</h1>
      <p className="mt-1 text-sm text-slate-400">
        {loading ? "Загрузка..." : `${rows.length} активных пользователей за неделю`}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Загрузка...</div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Нет активных пользователей</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Пользователь</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Тариф</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Сегодня</th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">За неделю</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {rows.map((row) => {
                  const limit = limitForPlan(row.plan);
                  return (
                    <tr key={row.userId} className="transition hover:bg-white/[0.03]">
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-white">
                          {row.displayName ?? <span className="text-slate-500">—</span>}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-600">{row.userId.slice(0, 8)}…</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300">
                          {row.plan}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`text-sm tabular-nums font-semibold ${row.requestsToday >= limit ? "text-red-400" : row.requestsToday >= limit * 0.8 ? "text-amber-400" : "text-white"}`}>
                            {row.requestsToday} / {limit}
                          </span>
                          <ProgressBar value={row.requestsToday} max={limit} />
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm tabular-nums text-slate-300">{row.requestsWeek}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
