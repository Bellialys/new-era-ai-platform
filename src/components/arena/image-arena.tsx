"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { IMAGE_MODELS } from "@/lib/arena/image-models";
import { IMAGE_MAX_PROMPT_CHARS, IMAGE_MAX_MODELS } from "@/lib/arena/constants";
import { ImageResponseCard } from "./image-response-card";

type Status = "idle" | "loading" | "done" | "error";

interface ImageResult {
  modelId: string;
  modelName: string;
  imageUrl: string | null;
  error?: string;
}

interface CompareResponse {
  taskId: string;
  results: ImageResult[];
  error?: string;
  message?: string;
}

export function ImageArena() {
  // Lazy initializer: if Supabase is not configured, we know immediately user is not authenticated.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() =>
    isSupabaseConfigured() ? null : false
  );
  const [prompt, setPrompt] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(["openai/dall-e-3", "openai/dall-e-2"]);
  const [status, setStatus] = useState<Status>("idle");
  const [results, setResults] = useState<ImageResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsAuthenticated(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  function toggleModel(id: string) {
    setSelectedModelIds((prev) => {
      if (prev.includes(id)) return prev.filter((m) => m !== id);
      if (prev.length >= IMAGE_MAX_MODELS) return prev;
      return [...prev, id];
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || selectedModelIds.length === 0 || status === "loading") return;

    setStatus("loading");
    setResults([]);
    setErrorMessage(null);
    setWinnerId(null);

    try {
      const res = await fetch("/api/image-compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), modelIds: selectedModelIds }),
      });

      const data = (await res.json()) as CompareResponse;

      if (!res.ok) {
        setStatus("error");
        setErrorMessage(data.message ?? data.error ?? "Произошла ошибка при генерации");
        return;
      }

      setResults(data.results);
      setStatus("done");
    } catch {
      setStatus("error");
      setErrorMessage("Не удалось подключиться к серверу");
    }
  }

  const promptCharsLeft = IMAGE_MAX_PROMPT_CHARS - prompt.length;

  return (
    <div className="space-y-6">
      {isAuthenticated === false && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Image Arena доступна только для зарегистрированных пользователей.{" "}
          <a href="/login" className="font-semibold underline underline-offset-2 hover:text-amber-100">
            Войти
          </a>{" "}
          или{" "}
          <a href="/signup" className="font-semibold underline underline-offset-2 hover:text-amber-100">
            создать аккаунт
          </a>
          .
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            Описание изображения
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={IMAGE_MAX_PROMPT_CHARS}
              rows={4}
              placeholder="Опишите изображение, которое хотите сгенерировать..."
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 pb-7 text-sm text-white placeholder-slate-500 outline-none transition focus:border-violet-400/60 focus:ring-1 focus:ring-violet-400/30 disabled:opacity-50"
              disabled={status === "loading" || isAuthenticated === false}
            />
            <span
              className={`absolute bottom-2 right-3 text-xs ${
                promptCharsLeft < 100 ? "text-amber-400" : "text-slate-500"
              }`}
            >
              {promptCharsLeft}
            </span>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-300">
            Модели (до {IMAGE_MAX_MODELS})
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {IMAGE_MODELS.map((model) => {
              const isSelected = selectedModelIds.includes(model.id);
              const isDisabled =
                status === "loading" ||
                isAuthenticated === false ||
                (!isSelected && selectedModelIds.length >= IMAGE_MAX_MODELS);
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => toggleModel(model.id)}
                  disabled={isDisabled}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "border-violet-400/60 bg-violet-500/20 text-white"
                      : "border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/20 hover:text-white"
                  } disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  <span className={`h-4 w-4 shrink-0 rounded border-2 transition ${
                    isSelected ? "border-violet-400 bg-violet-500" : "border-white/20 bg-transparent"
                  }`} />
                  <span className="flex-1 font-medium">{model.name}</span>
                  {model.badge.map((b) => (
                    <span
                      key={b}
                      className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                        b === "free"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : b === "openai"
                          ? "bg-sky-500/20 text-sky-300"
                          : "bg-violet-500/20 text-violet-300"
                      }`}
                    >
                      {b}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={
            status === "loading" ||
            !prompt.trim() ||
            selectedModelIds.length === 0 ||
            isAuthenticated === false
          }
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === "loading" ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Генерируем изображения...
            </>
          ) : (
            "Сгенерировать"
          )}
        </button>
      </form>

      {status === "error" && errorMessage && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </div>
      )}

      {status === "done" && results.length > 0 && (
        <div className="space-y-4">
          {winnerId && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
              Победитель: {results.find((r) => r.modelId === winnerId)?.modelName ?? winnerId}
            </div>
          )}
          <div
            className={`grid gap-4 ${
              results.length === 1
                ? "grid-cols-1 max-w-md"
                : results.length === 2
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            }`}
          >
            {results.map((r) => (
              <ImageResponseCard
                key={r.modelId}
                modelId={r.modelId}
                modelName={r.modelName}
                badge={IMAGE_MODELS.find((m) => m.id === r.modelId)?.badge ?? []}
                imageUrl={r.imageUrl}
                error={r.error}
                isWinner={r.modelId === winnerId}
                isVoted={winnerId !== null}
                onVote={(id) => setWinnerId(id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
