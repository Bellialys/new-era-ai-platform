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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_right,rgba(124,58,237,0.16),transparent_28%),linear-gradient(180deg,#020617,#020617_55%,#030712)] text-slate-100">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r border-white/10 bg-slate-950/75 backdrop-blur-xl lg:flex lg:flex-col">
          <div className="px-6 py-7">
            <Link href="/admin" className="block">
              <p className="text-sm font-black tracking-tight text-white">Администрация</p>
              <p className="mt-1 text-xs text-slate-500">New Era AI Platform</p>
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-3" aria-label="Навигация администрации">
            {NAV_LINKS.map(({ href, label, hint }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center justify-between rounded-2xl px-3 py-3 text-sm text-slate-400 transition hover:bg-white/[0.07] hover:text-white"
              >
                <span className="font-semibold">{label}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-600 transition group-hover:text-violet-300">
                  {hint}
                </span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-white/10 p-5">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-violet-400/40 hover:bg-violet-500/10 hover:text-white"
            >
              ← На сайт
            </Link>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/75 px-4 py-3 backdrop-blur-xl lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <Link href="/admin" className="text-sm font-black text-white">
                Админка
              </Link>
              <Link href="/" className="text-xs font-semibold text-slate-400 hover:text-white">
                ← На сайт
              </Link>
            </div>
            <nav className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Мобильная навигация администрации">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-300"
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
