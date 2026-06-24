"use client";

import { useState, useEffect } from "react";

export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  plan: string;
  createdAt: string;
  lastSignInAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data: { users?: AdminUser[] }) => {
        if (cancelled) return;
        if (data.users) setUsers(data.users);
        else setError("Не удалось загрузить пользователей");
      })
      .catch(() => {
        if (!cancelled) setError("Ошибка при загрузке пользователей");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  async function updateUser(id: string, field: "role" | "plan", value: string) {
    const prevUser = users.find((u) => u.id === id);
    setSaving((prev) => new Set(prev).add(id));
    setUsers((prev) =>
      prev.map((u) => (u.id === id ? { ...u, [field]: value } : u))
    );

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok && prevUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, [field]: prevUser[field] } : u))
        );
      }
    } catch {
      if (prevUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === id ? { ...u, [field]: prevUser[field] } : u))
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
      <h1 className="text-3xl font-black text-white">Пользователи</h1>
      <p className="mt-1 text-sm text-slate-400">
        {loading ? "Загрузка..." : `${users.length.toLocaleString("ru-RU")} пользователей`}
      </p>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04]">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Загрузка...</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">Пользователи не найдены</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Пользователь
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Роль
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Тариф
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Регистрация
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className={`transition hover:bg-white/[0.03] ${saving.has(user.id) ? "opacity-60" : ""}`}
                  >
                    <td className="px-5 py-4">
                      <p className="text-sm font-semibold text-white">
                        {user.displayName ?? <span className="text-slate-500">—</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{user.email ?? "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={user.role}
                        disabled={saving.has(user.id)}
                        onChange={(e) => updateUser(user.id, "role", e.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={user.plan}
                        disabled={saving.has(user.id)}
                        onChange={(e) => updateUser(user.id, "plan", e.target.value)}
                        className="rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:cursor-not-allowed"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                      </select>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <p className="text-xs tabular-nums text-slate-300">
                        {formatDate(user.createdAt)}
                      </p>
                      {user.lastSignInAt && (
                        <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                          вход: {formatDate(user.lastSignInAt)}
                        </p>
                      )}
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
