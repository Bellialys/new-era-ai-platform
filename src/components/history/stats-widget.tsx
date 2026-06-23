"use client";

import { useEffect, useState } from "react";

type StatsData = {
  totalTasks: number;
  totalVotes: number;
  modeCounts: Record<string, number>;
  topModels: { display_name: string; count: number }[];
};

type StatsState = "loading" | "empty" | "ready" | "hidden";

export function StatsWidget() {
  const [state, setState] = useState<StatsState>("loading");
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { stats: StatsData | null } | null) => {
        const s = json?.stats;
        if (!s || s.totalTasks === 0) {
          setState("hidden");
        } else {
          setStats(s);
          setState(s.topModels.length > 0 ? "ready" : "empty");
        }
      })
      .catch(() => setState("hidden"));
  }, []);

  if (state === "loading" || state === "hidden") return null;

  const maxCount = stats?.topModels[0]?.count ?? 1;
  const promptCount = stats?.modeCounts["prompt-arena"] ?? 0;
  const codeCount = stats?.modeCounts["code-arena"] ?? 0;

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-slate-950/40 p-5 backdrop-blur-sm">
      <h2 className="mb-4 text-sm font-bold text-white">Твоя статистика</h2>

      {/* Totals row */}
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-black text-white">{stats?.totalTasks ?? 0}</p>
          <p className="mt-0.5 text-xs text-slate-500">Сравнений</p>
        </div>
        <div>
          <p className="text-xl font-black text-white">{stats?.totalVotes ?? 0}</p>
          <p className="mt-0.5 text-xs text-slate-500">Голосов</p>
        </div>
        <div>
          <p className="text-xl font-black text-white">
            {promptCount + codeCount > 0
              ? Math.round((codeCount / (promptCount + codeCount)) * 100)
              : 0}
            %
          </p>
          <p className="mt-0.5 text-xs text-slate-500">Code Arena</p>
        </div>
      </div>

      {/* Top models */}
      {state === "ready" && stats && stats.topModels.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-400">
            Победители по твоим голосам
          </p>
          <div className="space-y-2">
            {stats.topModels.slice(0, 5).map((m, i) => (
              <div key={m.display_name} className="flex items-center gap-3">
                <span className="w-4 shrink-0 text-xs text-slate-600">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-slate-200">
                      {m.display_name}
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">{m.count}×</span>
                  </div>
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-violet-500/70 transition-all"
                      style={{ width: `${Math.round((m.count / maxCount) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {state === "empty" && (
        <p className="text-xs text-slate-500">
          Проголосуй за лучшую модель — здесь появится статистика.
        </p>
      )}
    </div>
  );
}
