"use client";

import { useState } from "react";

type CodeTemplate = {
  id: string;
  label: string;
  text: string;
  language: string;
};

const CODE_TEMPLATES: CodeTemplate[] = [
  {
    id: "react-component",
    label: "React компонент",
    text: "Напиши React компонент {{название}} на TypeScript с использованием хуков. Компонент должен: {{описание функциональности}}. Используй Tailwind CSS для стилей.",
    language: "TypeScript",
  },
  {
    id: "api-route",
    label: "API route (Next.js)",
    text: "Напиши Next.js App Router API route handler для эндпоинта {{метод}} {{путь}}. Включи валидацию входных данных, обработку ошибок и правильные HTTP-статусы.",
    language: "TypeScript",
  },
  {
    id: "sql-schema",
    label: "SQL схема",
    text: "Спроектируй SQL схему для {{описание системы}}. Включи индексы, внешние ключи, CHECK constraints и RLS политики (если PostgreSQL/Supabase).",
    language: "SQL",
  },
  {
    id: "python-script",
    label: "Python скрипт",
    text: "Напиши Python скрипт для {{задача}}. Требования: {{требования}}. Включи обработку ошибок, логирование и type hints.",
    language: "Python",
  },
  {
    id: "algorithm",
    label: "Алгоритм",
    text: "Реализуй алгоритм {{название}} на {{язык}}. Объясни временную и пространственную сложность. Добавь тесты для граничных случаев.",
    language: "TypeScript",
  },
  {
    id: "refactor-code",
    label: "Рефакторинг",
    text: "Отрефактори следующий код: улучши читаемость, производительность и структуру. Объясни каждое изменение.\n\n```\n{{код}}\n```",
    language: "TypeScript",
  },
];

type CodeTemplatesProps = {
  onSelect: (text: string, language?: string) => void;
};

export function CodeTemplates({ onSelect }: CodeTemplatesProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-slate-200"
      >
        <span>⚡</span> Шаблоны
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-bold text-white">Шаблоны кода</span>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-white">
          Закрыть
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {CODE_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onSelect(t.text, t.language);
              setOpen(false);
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-200">{t.label}</span>
              <span className="rounded-full bg-blue-500/15 px-1.5 py-0.5 text-xs text-blue-300">
                {t.language}
              </span>
            </div>
            <p className="line-clamp-2 text-xs text-slate-500">{t.text.slice(0, 70)}…</p>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Замените {"{{placeholder}}"} на ваши данные. Язык устанавливается автоматически.
      </p>
    </div>
  );
}
