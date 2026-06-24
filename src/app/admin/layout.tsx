import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/server/admin";

export const metadata = {
  title: "Администрация — Новая эпоха",
};

const NAV_LINKS = [
  { href: "/admin", label: "Дашборд" },
  { href: "/admin/models", label: "Модели" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/usage", label: "Использование" },
  { href: "/admin/audit", label: "Аудит" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-52 shrink-0 border-r border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="px-5 py-6">
          <Link href="/admin" className="text-sm font-bold tracking-tight text-white">
            Администрация
          </Link>
          <p className="mt-1 text-xs text-slate-500">Новая эпоха</p>
        </div>

        <nav className="px-3 pb-6" aria-label="Навигация администрации">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center rounded-lg px-3 py-2 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <Link
            href="/"
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            ← На сайт
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-auto px-8 py-8">{children}</main>
    </div>
  );
}
