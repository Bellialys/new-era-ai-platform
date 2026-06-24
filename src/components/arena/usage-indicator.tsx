"use client";

import { useEffect, useState } from "react";

type UsageData = {
  used: number;
  limit: number;
  plan: string;
};

const PLAN_LABELS: Record<string, string> = {
  admin: "Admin",
  pro: "Pro",
  free: "Free",
  anonymous: "Guest",
};

export function UsageIndicator() {
  const [data, setData] = useState<UsageData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageData | null) => {
        if (!cancelled && d) setData(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!data) return null;

  const { used, limit, plan } = data;

  if (plan === "admin" || plan === "pro") {
    return (
      <div className="mt-3 flex items-center gap-2">
        <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-xs font-semibold text-violet-300">
          {PLAN_LABELS[plan] ?? plan}
        </span>
        <span className="text-xs text-slate-500">Расширенный доступ</span>
      </div>
    );
  }

  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const isAtLimit = used >= limit;
  const isNearLimit = pct >= 80;

  const barColor = isAtLimit ? "bg-red-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-500";
  const textColor = isAtLimit ? "text-red-400" : isNearLimit ? "text-amber-400" : "text-slate-400";

  return (
    <div className="mt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${textColor}`}>
          {isAtLimit
            ? "Лимит исчерпан"
            : `Запросов сегодня: ${used} / ${limit}`}
        </span>
        <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-xs text-slate-500">
          {PLAN_LABELS[plan] ?? plan}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
