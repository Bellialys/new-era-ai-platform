import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";
import { AdminNavLink } from "@/components/layout/admin-nav-link";

interface SiteHeaderProps {
  /** Дополнительный контент (подзаголовок, бейдж режима и т.п.) */
  children?: React.ReactNode;
}

export function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Новая эпоха
        </Link>
        <nav aria-label="Навигация" className="hidden items-center sm:flex">
          <Link
            href="/leaderboard"
            className="rounded-full px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            Рейтинг
          </Link>
          <Link
            href="/image"
            className="rounded-full px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            Изображения
          </Link>
          <AdminNavLink />
        </nav>
        {children}
      </div>
      <nav aria-label="Аккаунт">
        <AuthStatus />
      </nav>
    </header>
  );
}
