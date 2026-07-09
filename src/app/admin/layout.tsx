import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/server/admin";

export const metadata = {
  title: "Администрация — Новая эпоха",
};

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд", hint: "Обзор" },
  { href: "/admin/models", label: "Модели", hint: "Каталог" },
  { href: "/admin/users", label: "Пользователи", hint: "Роли" },
  { href: "/admin/usage", label: "Использование", hint: "Лимиты" },
  { href: "/admin/audit", label: "Аудит", hint: "Логи" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_12%,rgba(34,211,238,0.22),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(168,85,247,0.30),transparent_34%),radial-gradient(circle_at_55%_95%,rgba(14,165,233,0.18),transparent_42%),linear-gradient(135deg,#07111f_0%,#10143a_42%,#1d1235_72%,#090d1a_100%)] text-slate-100">
      <div className="flex min-h-screen bg-[linear-gradient(90deg,rgba(8,13,28,0.92),rgba(8,13,28,0.62)_22%,rgba(8,13,28,0.24)_100%)]">
        <aside className="hidden w-64 shrink-0 border-r border-cyan-200/10 bg-[#081427]/85 shadow-2xl shadow-cyan-950/30 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="px-6 py-7">
            <Link href="/admin" className="block">
              <p className="text-sm font-black tracking-tight text-white">Администрация</p>
              <p className="mt-1 text-xs text-cyan-200/55">New Era AI Platform</p>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3" aria-label="Навигация администрации">
            {NAV_LINKS.map(({ href, label, hint }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between rounded-2xl px-3 py-3 text-sm text-slate-300/80 transition hover:bg-cyan-300/[0.09] hover:text-white"
              >
                <span className="font-semibold">{label}</span>
                <span className="text-[10px] uppercase tracking-wider text-cyan-200/35 transition group-hover:text-cyan-200">
                  {hint}
                </span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-cyan-200/10 p-5">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-cyan-200/10 bg-cyan-200/[0.05] px-3 py-2 text-xs font-semibold text-cyan-100/80 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white"
            >
              ← На сайт
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-cyan-200/10 bg-[#081427]/85 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" className="text-sm font-black text-white">
                Админка
              </Link>
              <Link href="/" className="text-xs font-semibold text-cyan-100/70 hover:text-white">
                ← На сайт
              </Link>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Мобильная навигация администрации">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="shrink-0 rounded-full border border-cyan-200/10 bg-cyan-200/[0.05] px-3 py-1.5 text-xs font-semibold text-cyan-50/80"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </header>

          <main className="flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
