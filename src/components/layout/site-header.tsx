import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";

interface SiteHeaderProps {
  /** Дополнительный контент (подзаголовок, бейдж режима и т.п.) */
  children?: React.ReactNode;
}

/**
 * Единый хедер сайта: логотип + кнопки входа/регистрации.
 * Навигационные ссылки между разделами — внутри страниц, не здесь.
 */
export function SiteHeader({ children }: SiteHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Новая эпоха
        </Link>
        {children}
      </div>
      <nav aria-label="Аккаунт">
        <AuthStatus />
      </nav>
    </header>
  );
}
