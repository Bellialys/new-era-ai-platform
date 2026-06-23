import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Условия использования — Новая эпоха",
};

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <SiteHeader />
      <div className="mt-10">
        <h1 className="text-2xl font-black text-white">Условия использования</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-slate-400">
          <p>Используя Новая эпоха, вы соглашаетесь с данными условиями.</p>
          <p><strong className="text-white">Платформа:</strong> предоставляется «как есть» для исследовательских и образовательных целей. Мы не гарантируем непрерывную доступность или точность ответов AI-моделей.</p>
          <p><strong className="text-white">Использование:</strong> запрещено использование платформы для генерации вредоносного контента, спама, дезинформации или нарушения прав третьих лиц.</p>
          <p><strong className="text-white">Ответы AI:</strong> генерируются автоматически и могут содержать ошибки. Не используйте их как профессиональную медицинскую, юридическую или финансовую консультацию.</p>
          <p><strong className="text-white">Изменения:</strong> условия могут обновляться без предварительного уведомления. Актуальная версия всегда доступна на этой странице.</p>
          <p>По вопросам: ae995955@gmail.com</p>
        </div>
        <div className="mt-8"><Link href="/" className="text-sm text-violet-400 hover:underline">← На главную</Link></div>
      </div>
    </main>
  );
}
