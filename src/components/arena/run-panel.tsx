"use client";

import { useState } from "react";
import { findLanguageKey } from "@/lib/arena/code-languages";

type RunPanelProps = {
  code: string;
  language: string;
  responseId?: string;
  isAuthenticated: boolean;
};

type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  cpuTime: number;
};

function extractCode(text: string): string {
  const match = text.match(/```[\w]*\n?([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export function RunPanel({ code, language, responseId, isAuthenticated }: RunPanelProps) {
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const langKey = findLanguageKey(language);

  if (!langKey) return null;

  if (!isAuthenticated) {
    return (
      <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
        Войдите для запуска кода
      </div>
    );
  }

  async function handleRun() {
    const codeToRun = extractCode(code);
    if (!codeToRun) return;

    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/code-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToRun, language: langKey, responseId }),
      });

      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        cpuTime?: number;
        error?: { message?: string };
      };

      if (!res.ok) {
        setError(data.error?.message ?? "Ошибка выполнения.");
        return;
      }

      setResult({
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        exitCode: data.exitCode ?? 0,
        cpuTime: data.cpuTime ?? 0,
      });
    } catch {
      setError("Ошибка сети. Попробуйте снова.");
    } finally {
      setIsRunning(false);
    }
  }

  const hasOutput = result && (result.stdout || result.stderr);
  const isError = result && result.exitCode !== 0;

  return (
    <div className="mt-3">
      <button
        onClick={handleRun}
        disabled={isRunning}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-600/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/70 hover:bg-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
      >
        {isRunning ? "Выполняется..." : "▶ Запустить"}
      </button>

      {error ? (
        <div className="mt-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      {hasOutput ? (
        <div
          className={`mt-2 rounded-2xl border px-4 py-3 font-mono text-sm leading-relaxed ${
            isError
              ? "border-red-400/20 bg-black/80"
              : "border-white/5 bg-black/80"
          }`}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">Вывод</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                isError
                  ? "bg-red-500/20 text-red-300"
                  : "bg-emerald-500/20 text-emerald-300"
              }`}
            >
              exit {result.exitCode}
            </span>
          </div>
          {result.stdout ? (
            <pre className="overflow-x-auto whitespace-pre-wrap text-green-400">{result.stdout}</pre>
          ) : null}
          {result.stderr ? (
            <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-amber-400">{result.stderr}</pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
