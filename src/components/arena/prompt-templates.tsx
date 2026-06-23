"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Template catalog
// ---------------------------------------------------------------------------
type TemplateCategory = "general" | "code" | "business" | "data";

type PromptTemplate = {
  id: string;
  category: TemplateCategory;
  label: string;
  text: string;
};

const CATEGORIES: { value: TemplateCategory; label: string }[] = [
  { value: "general", label: "Общее" },
  { value: "code", label: "Код" },
  { value: "business", label: "Бизнес" },
  { value: "data", label: "Данные" },
];

const TEMPLATES: PromptTemplate[] = [
  // General
  {
    id: "explain-concept",
    category: "general",
    label: "Объяснить концепцию",
    text: "Объясни концепцию {{концепция}} простыми словами. Включи аналогию из реального мира, ключевые принципы и примеры использования.",
  },
  {
    id: "pros-cons",
    category: "general",
    label: "Плюсы и минусы",
    text: "Сравни {{вариант A}} и {{вариант B}}. Для каждого опиши плюсы, минусы, идеальный сценарий использования и ключевые ограничения.",
  },
  {
    id: "step-by-step",
    category: "general",
    label: "Пошаговая инструкция",
    text: "Дай пошаговую инструкцию: как {{задача}}. Аудитория: {{уровень пользователя}}. Включи типичные ошибки и советы.",
  },
  // Code
  {
    id: "code-review",
    category: "code",
    label: "Code review",
    text: "Сделай code review следующего кода. Оцени читаемость, производительность, безопасность и соответствие best practices. Предложи конкретные улучшения.\n\n```\n{{код}}\n```",
  },
  {
    id: "refactor",
    category: "code",
    label: "Рефакторинг",
    text: "Отрефактори следующий код: сделай его чище, удали дублирование, улучши именование переменных и структуру. Объясни каждое изменение.\n\n```{{язык}}\n{{код}}\n```",
  },
  {
    id: "implement-feature",
    category: "code",
    label: "Реализовать фичу",
    text: "Реализуй {{описание фичи}} на {{язык/фреймворк}}. Включи обработку ошибок, типизацию (если применимо) и краткий комментарий к ключевым решениям.",
  },
  {
    id: "debug",
    category: "code",
    label: "Найти баг",
    text: "В следующем коде есть баг. Найди его, объясни причину и предложи исправление:\n\n```{{язык}}\n{{код}}\n```\n\nОшибка: {{сообщение об ошибке}}",
  },
  // Business
  {
    id: "business-letter",
    category: "business",
    label: "Деловое письмо",
    text: "Напиши деловое письмо от {{отправитель}} к {{получатель}} по теме: {{тема}}.\nТон: профессиональный, {{дополнительный тон}}.\nКлючевые пункты: {{пункты}}.",
  },
  {
    id: "marketing-copy",
    category: "business",
    label: "Маркетинговый текст",
    text: "Напиши маркетинговый текст для {{продукт/услуга}}.\nЦелевая аудитория: {{аудитория}}.\nКлючевые преимущества: {{преимущества}}.\nТон: {{тон}}. Длина: {{длина}}.",
  },
  {
    id: "meeting-summary",
    category: "business",
    label: "Резюме встречи",
    text: "Составь резюме встречи по следующим заметкам:\n\n{{заметки}}\n\nВключи: ключевые решения, action items с ответственными и следующие шаги.",
  },
  // Data
  {
    id: "sql-query",
    category: "data",
    label: "SQL запрос",
    text: "Напиши SQL запрос для следующей задачи: {{задача}}.\n\nСхема таблиц:\n{{схема}}\n\nБаза данных: {{PostgreSQL / MySQL / SQLite}}.",
  },
  {
    id: "data-analysis",
    category: "data",
    label: "Анализ данных",
    text: "Помоги проанализировать следующие данные:\n\n{{данные}}\n\nЗадача: {{что нужно найти / понять}}. Предложи подход, ключевые метрики и возможные выводы.",
  },
  {
    id: "regex",
    category: "data",
    label: "Регулярное выражение",
    text: "Напиши регулярное выражение для: {{описание паттерна}}.\nЯзык/среда: {{JavaScript / Python / Go}}.\nПриведи примеры строк, которые должны совпасть и не совпасть.",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
type PromptTemplatesProps = {
  onSelect: (text: string) => void;
};

export function PromptTemplates({ onSelect }: PromptTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>("general");

  const filtered = TEMPLATES.filter((t) => t.category === activeCategory);

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
        <span className="text-sm font-bold text-white">Шаблоны задач</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-white"
        >
          Закрыть
        </button>
      </div>

      {/* Category tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setActiveCategory(cat.value)}
            className={`rounded-full px-3 py-0.5 text-xs font-semibold transition ${
              activeCategory === cat.value
                ? "bg-violet-500/30 text-violet-100"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates grid */}
      <div className="grid gap-2 sm:grid-cols-2">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              onSelect(t.text);
              setOpen(false);
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition hover:border-white/20 hover:bg-white/[0.07]"
          >
            <p className="mb-1 text-xs font-semibold text-slate-200">{t.label}</p>
            <p className="line-clamp-2 text-xs text-slate-500">{t.text.slice(0, 80)}…</p>
          </button>
        ))}
      </div>

      <p className="mt-3 text-xs text-slate-600">
        Замените {"{{placeholder}}"} на ваши данные после выбора шаблона.
      </p>
    </div>
  );
}
