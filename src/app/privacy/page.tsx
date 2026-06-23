import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Политика конфиденциальности — Новая эпоха",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <SiteHeader />
      <div className="mt-10">
        <h1 className="text-2xl font-black text-white">Политика конфиденциальности</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-slate-400">
          <p>Новая эпоха — исследовательская AI-платформа. Мы собираем минимальный объём данных, необходимый для работы сервиса.</p>
          <p><strong className="text-white">Что мы сохраняем:</strong> тексты запросов и ответы AI-моделей в базе данных для формирования истории сравнений. Email-адрес при регистрации. Анонимный идентификатор сессии для гостей.</p>
          <p><strong className="text-white">Что мы не делаем:</strong> не продаём данные, не показываем рекламу, не передаём данные третьим лицам, кроме OpenRouter (AI-провайдер, обрабатывающий запросы).</p>
          <p><strong className="text-white">Запросы к AI:</strong> обрабатываются через OpenRouter API. Ознакомьтесь с политикой OpenRouter на{" "}<a href="https://openrouter.ai/privacy" className="text-violet-400 hover:underline" target="_blank" rel="noopener noreferrer">openrouter.ai/privacy</a>.</p>
          <p>По вопросам конфиденциальности: ae995955@gmail.com</p>
        </div>
        <div className="mt-8"><Link href="/" className="text-sm text-violet-400 hover:underline">← На главную</Link></div>
      </div>
    </main>
  );
}
