"use client";

import { useState } from "react";

interface ImageResponseCardProps {
  modelId: string;
  modelName: string;
  badge: readonly string[];
  imageUrl: string | null;
  error?: string;
  isWinner: boolean;
  isVoted: boolean;
  onVote: (modelId: string) => void;
}

const BADGE_COLORS: Record<string, string> = {
  image: "bg-violet-500/20 text-violet-300",
  openai: "bg-sky-500/20 text-sky-300",
  free: "bg-emerald-500/20 text-emerald-300",
};

export function ImageResponseCard({
  modelId,
  modelName,
  badge,
  imageUrl,
  error,
  isWinner,
  isVoted,
  onVote,
}: ImageResponseCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border transition ${
        isWinner
          ? "border-amber-400/60 bg-amber-500/10 shadow-lg shadow-amber-950/20"
          : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
        <span className="flex-1 font-semibold text-white">{modelName}</span>
        {badge.map((b) => (
          <span
            key={b}
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE_COLORS[b] ?? "bg-white/10 text-slate-400"}`}
          >
            {b}
          </span>
        ))}
        {isWinner && (
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300">
            Победитель
          </span>
        )}
      </div>

      <div className="relative flex-1">
        {imageUrl ? (
          <>
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/[0.03]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Изображение от ${modelName}`}
              className={`w-full object-cover transition-opacity duration-300 ${imgLoaded ? "opacity-100" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
            />
          </>
        ) : (
          <div className="flex min-h-48 items-center justify-center px-4 py-8 text-center">
            <p className="text-sm text-red-400">{error ?? "Не удалось сгенерировать изображение"}</p>
          </div>
        )}
      </div>

      {imageUrl && !isVoted && (
        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={() => onVote(modelId)}
            className="w-full rounded-xl border border-amber-400/30 bg-amber-500/10 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/20"
          >
            Выбрать победителя 🏆
          </button>
        </div>
      )}
    </div>
  );
}
