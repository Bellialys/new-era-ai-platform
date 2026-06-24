"use client";

import { useState, useEffect } from "react";

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

const ACCESS_LEVEL_LABELS: Record<string, string> = {
  anonymous: "Гости",
  registered: "Зарегистрированные",
  premium: "Pro",
};

export default function AdminModelsPage() {
  const [models, setModels] = useState<AdminModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

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
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(id: string, newValue: boolean) {
    setSaving((prev) => new Set(prev).add(id));
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, is_active: newValue } : m))
    );

    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newValue }),
      });
      if (!res.ok) {
        setModels((prev) =>
          prev.map((m) => (m.id === id ? { ...m, is_active: !newValue } : m))
        );
      }
    } catch {
      setModels((prev) =>
        prev.map((m) => (m.id === id ? { ...m, is_active: !newValue } : m))
      );
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
    const prev_access = models.find((m) => m.id === id)?.access_level;
    setModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, access_level } : m))
    );

    try {
      const res = await fetch(`/api/admin/models/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_level }),
      });
      if (!res.ok && prev_access) {
        setModels((prev) =>
          prev.map((m) => (m.id === id ? { ...m, access_level: prev_access } : m))
        );
      }
    } catch {
      if (prev_access) {
        setModels((prev) =>
          prev.map((m) => (m.id === id ? { ...m, access_level: prev_access } : m))
        );
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
    <div>
      <h1 className="text-3xl font-black text-white">Модели</h1>
      <p className="mt-1 text-sm text-slate-400">Управление каталогом моделей</p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Загрузка...</div>
        ) : models.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Модели не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Модель
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Доступ
                  </th>
                  <th className="px-5 py-3.5 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Активна
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Ответов
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {models.map((model) => (
                  <tr
                    key={model.id}
                    className={`transition hover:bg-white/[0.03] ${saving.has(model.id) ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{model.name}</span>
                        {model.badge.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-violet-500/15 px-2 py-0.5 text-xs text-violet-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-500">{model.model_key}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={model.access_level}
                        disabled={saving.has(model.id)}
                        onChange={(e) => changeAccessLevel(model.id, e.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed"
                      >
                        {Object.entries(ACCESS_LEVEL_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={model.is_active}
                        disabled={saving.has(model.id)}
                        onChange={(e) => toggleActive(model.id, e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-white/20 bg-slate-900 accent-violet-500 disabled:cursor-not-allowed"
                        aria-label={`Активность модели ${model.name}`}
                      />
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-sm text-slate-300">
                      {model.totalResponses.toLocaleString("ru-RU")}
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
