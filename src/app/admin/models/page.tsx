"use client";

import { useEffect, useMemo, useState } from "react";

export const dynamic = "force-dynamic";

type AdminModel = {
  id: string;
  name: string;
  model_key: string;
  badge: string[];
  is_active: boolean;
  access_level: string;
  totalResponses: number;
};

type StatusFilter = "all" | "active" | "disabled";

type FilterButtonProps = {
  active: boolean;
  children: string;
  onClick: () => void;
};

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  anonymous: "Гости",
  registered: "Зарегистрированные",
  premium: "Pro",
};

function FilterButton({ active, children, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-100"
          : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-cyan-300/30 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accessFilter, setAccessFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/models")
      .then((r) => r.json())
      .then((data: { models?: AdminModel[] }) => {
        if (cancelled) return;
        if (data.models) setModels(data.models);
        else setError("Не удалось загрузить модели");
      })
      .catch(() => {
        if (!cancelled) setError("Ошибка при загрузке моделей");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const active = models.filter((model) => model.is_active).length;
    const responses = models.reduce((sum, model) => sum + model.totalResponses, 0);
    return {
      active,
      disabled: Math.max(models.length - active, 0),
      responses,
      total: models.length,
    };
  }, [models]);

  const filteredModels = useMemo(() => {
    const query = search.trim().toLowerCase();
    return models.filter((model) => {
      const matchesQuery =
        query.length === 0 ||
        model.name.toLowerCase().includes(query) ||
        model.model_key.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && model.is_active) ||
        (statusFilter === "disabled" && !model.is_active);
      const matchesAccess = accessFilter === "all" || model.access_level === accessFilter;
      return matchesQuery && matchesStatus && matchesAccess;
    });
  }, [accessFilter, models, search, statusFilter]);

  async function toggleActive(id: string, newValue: boolean) {
    setSaving((prev) => new Set(prev).add(id));
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: newValue } : m)));

    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newValue }),
      });
      if (!res.ok) {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !newValue } : m)));
      }
    } catch {
      setModels((prev) => prev.map((m) => (m.id === id ? { ...m, is_active: !newValue } : m)));
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function changeAccessLevel(id: string, access_level: string) {
    setSaving((prev) => new Set(prev).add(id));
    const previousAccess = models.find((m) => m.id === id)?.access_level;
    setModels((prev) => prev.map((m) => (m.id === id ? { ...m, access_level } : m)));

    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_level }),
      });
      if (!res.ok && previousAccess) {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, access_level: previousAccess } : m)));
      }
    } catch {
      if (previousAccess) {
        setModels((prev) => prev.map((m) => (m.id === id ? { ...m, access_level: previousAccess } : m)));
      }
    } finally {
      setSaving((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-cyan-200/10 bg-white/[0.055] p-6 shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">Model control</p>
            <h1 className="mt-2 text-3xl font-black text-white">Модели</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Управление каталогом AI-моделей: доступ, активность и фактическое количество ответов.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-96">
            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-3">
              <p className="text-xl font-black text-white">{stats.total}</p>
              <p className="text-[11px] text-cyan-100/60">всего</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/10 bg-emerald-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-emerald-100">{stats.active}</p>
              <p className="text-[11px] text-emerald-100/60">active</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-200/10 bg-fuchsia-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-fuchsia-100">{stats.responses}</p>
              <p className="text-[11px] text-fuchsia-100/60">ответов</p>
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
            placeholder="Поиск по названию или model_key"
            className="min-h-11 w-full rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40 xl:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <FilterButton active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>Все</FilterButton>
            <FilterButton active={statusFilter === "active"} onClick={() => setStatusFilter("active")}>Активные</FilterButton>
            <FilterButton active={statusFilter === "disabled"} onClick={() => setStatusFilter("disabled")}>Выключены</FilterButton>
            <select
              value={accessFilter}
              onChange={(event) => setAccessFilter(event.target.value)}
              className="rounded-full border border-cyan-200/10 bg-[#0b1930] px-3 py-1.5 text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-300/40"
            >
              <option value="all">Любой доступ</option>
              {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20">
          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Загрузка моделей...</div>
          ) : filteredModels.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Модели не найдены по выбранным фильтрам</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px]">
                <thead>
                  <tr className="border-b border-cyan-200/10 bg-cyan-200/[0.035]">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Модель</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Доступ</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Статус</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Ответов</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/[0.08]">
                  {filteredModels.map((model) => (
                    <tr key={model.id} className={`transition hover:bg-cyan-200/[0.04] ${saving.has(model.id) ? "opacity-60" : ""}`}>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-white">{model.name}</span>
                          {model.badge.map((badge) => (
                            <span key={badge} className="rounded-full border border-fuchsia-300/20 bg-fuchsia-300/10 px-2 py-0.5 text-xs text-fuchsia-100">
                              {badge}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 font-mono text-xs text-cyan-100/35">{model.model_key}</p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={model.access_level}
                          disabled={saving.has(model.id)}
                          onChange={(event) => changeAccessLevel(model.id, event.target.value)}
                          className="rounded-xl border border-cyan-200/10 bg-[#0b1930] px-3 py-2 text-xs text-cyan-50 outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed"
                        >
                          {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <label className="inline-flex items-center gap-2 rounded-full border border-cyan-200/10 bg-white/[0.04] px-3 py-1.5 text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={model.is_active}
                            disabled={saving.has(model.id)}
                            onChange={(event) => toggleActive(model.id, event.target.checked)}
                            className="h-4 w-4 cursor-pointer rounded border-cyan-200/20 bg-slate-900 accent-cyan-400 disabled:cursor-not-allowed"
                            aria-label={`Активность модели ${model.name}`}
                          />
                          {model.is_active ? "active" : "disabled"}
                        </label>
                      </td>
                      <td className="px-5 py-4 text-right tabular-nums text-sm font-semibold text-cyan-50">
                        {model.totalResponses.toLocaleString("ru-RU")}
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
