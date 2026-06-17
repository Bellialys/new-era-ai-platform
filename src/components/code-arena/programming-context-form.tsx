"use client";

import {
  CODE_ARENA_LANGUAGES,
  CODE_ARENA_FRAMEWORKS,
  type CodeArenaLanguage,
} from "@/lib/arena/constants";

type ProgrammingContextFormProps = {
  language: string;
  framework: string | null;
  onLanguageChange: (language: CodeArenaLanguage) => void;
  onFrameworkChange: (framework: string | null) => void;
};

export function ProgrammingContextForm({
  language,
  framework,
  onLanguageChange,
  onFrameworkChange,
}: ProgrammingContextFormProps) {
  const currentLanguage = language as CodeArenaLanguage;
  const frameworks = CODE_ARENA_FRAMEWORKS[currentLanguage] ?? [];

  function handleLanguageChange(value: string) {
    const lang = value as CodeArenaLanguage;
    onLanguageChange(lang);
    // Reset framework when language changes
    onFrameworkChange(null);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-2 text-sm text-slate-300">
        Язык программирования
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-violet-300/60"
        >
          {CODE_ARENA_LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>
              {lang}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-2 text-sm text-slate-300">
        Фреймворк / стек
        <select
          value={framework ?? ""}
          onChange={(e) => onFrameworkChange(e.target.value || null)}
          className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition focus:border-violet-300/60"
        >
          <option value="">— без фреймворка —</option>
          {frameworks.map((fw) => (
            <option key={fw} value={fw}>
              {fw}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
