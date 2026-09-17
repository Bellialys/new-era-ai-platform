"use client";

import { useEffect, useMemo, useState } from "react";

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
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");

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
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      admins: users.filter((user) => user.role === "admin").length,
      free: users.filter((user) => user.plan === "free").length,
      pro: users.filter((user) => user.plan === "pro").length,
      total: users.length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        query.length === 0 ||
        user.email?.toLowerCase().includes(query) ||
        user.displayName?.toLowerCase().includes(query) ||
        user.id.toLowerCase().includes(query);
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesPlan = planFilter === "all" || user.plan === planFilter;
      return matchesQuery && matchesRole && matchesPlan;
    });
  }, [planFilter, roleFilter, search, users]);

  async function updateUser(id: string, field: "role" | "plan", value: string) {
    const prevUser = users.find((u) => u.id === id);
    setSaving((prev) => new Set(prev).add(id));
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: value } : u)));

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok && prevUser) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: prevUser[field] } : u)));
      }
    } catch {
      if (prevUser) {
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, [field]: prevUser[field] } : u)));
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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200/70">User control</p>
            <h1 className="mt-2 text-3xl font-black text-white">Пользователи</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Администрирование ролей и тарифов без удаления аккаунтов. Все изменения проходят через admin API.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[28rem]">
            <div className="rounded-2xl border border-cyan-200/10 bg-cyan-200/[0.06] px-3 py-3">
              <p className="text-xl font-black text-white">{stats.total}</p>
              <p className="text-[11px] text-cyan-100/60">всего</p>
            </div>
            <div className="rounded-2xl border border-violet-200/10 bg-violet-300/[0.08] px-3 py-3">
              <p className="text-xl font-black text-violet-100">{stats.admins}</p>
              <p className="text-[11px] text-violet-100/60">admin</p>
            </div>
            <div className="rounded-2xl border border-emerald-200/10 bg-emerald-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-emerald-100">{stats.free}</p>
              <p className="text-[11px] text-emerald-100/60">free</p>
            </div>
            <div className="rounded-2xl border border-fuchsia-200/10 bg-fuchsia-300/[0.06] px-3 py-3">
              <p className="text-xl font-black text-fuchsia-100">{stats.pro}</p>
              <p className="text-[11px] text-fuchsia-100/60">pro</p>
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
            placeholder="Поиск по email, имени или id"
            className="min-h-11 w-full rounded-2xl border border-cyan-200/10 bg-white/[0.06] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/40 xl:max-w-md"
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="rounded-full border border-cyan-200/10 bg-[#0b1930] px-3 py-1.5 text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-300/40"
            >
              <option value="all">Любая роль</option>
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
            <select
              value={planFilter}
              onChange={(event) => setPlanFilter(event.target.value)}
              className="rounded-full border border-cyan-200/10 bg-[#0b1930] px-3 py-1.5 text-xs font-semibold text-cyan-50 outline-none focus:border-cyan-300/40"
            >
              <option value="all">Любой тариф</option>
              <option value="free">free</option>
              <option value="pro">pro</option>
            </select>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-cyan-200/10 bg-black/20">
          {loading ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Загрузка пользователей...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-400">Пользователи не найдены по выбранным фильтрам</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-cyan-200/10 bg-cyan-200/[0.035]">
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Пользователь</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Роль</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Тариф</th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-cyan-100/55">Регистрация</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-200/[0.08]">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className={`transition hover:bg-cyan-200/[0.04] ${saving.has(user.id) ? "opacity-60" : ""}`}>
                      <td className="px-5 py-4">
                        <p className="text-sm font-semibold text-white">
                          {user.displayName ?? <span className="text-slate-500">Без имени</span>}
                        </p>
                        <p className="mt-1 text-xs text-cyan-100/45">{user.email ?? "—"}</p>
                        <p className="mt-0.5 font-mono text-[11px] text-cyan-100/25">{user.id.slice(0, 8)}…</p>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={user.role}
                          disabled={saving.has(user.id)}
                          onChange={(event) => updateUser(user.id, "role", event.target.value)}
                          className="rounded-xl border border-cyan-200/10 bg-[#0b1930] px-3 py-2 text-xs text-cyan-50 outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-4">
                        <select
                          value={user.plan}
                          disabled={saving.has(user.id)}
                          onChange={(event) => updateUser(user.id, "plan", event.target.value)}
                          className="rounded-xl border border-cyan-200/10 bg-[#0b1930] px-3 py-2 text-xs text-cyan-50 outline-none focus:border-cyan-300/40 disabled:cursor-not-allowed"
                        >
                          <option value="free">free</option>
                          <option value="pro">pro</option>
                        </select>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <p className="text-xs tabular-nums text-cyan-50/85">{formatDate(user.createdAt)}</p>
                        {user.lastSignInAt && (
                          <p className="mt-1 text-xs tabular-nums text-cyan-100/35">вход: {formatDate(user.lastSignInAt)}</p>
                        )}
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
