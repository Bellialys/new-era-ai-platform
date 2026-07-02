import type { GuestInfo } from "@/lib/guest";

type GuestSessionCardVariant = "prompt" | "code";

type GuestSessionCardProps = {
  info: GuestInfo;
  onSignIn: () => void;
  variant?: GuestSessionCardVariant;
};

const AVATAR_COLORS = [
  "bg-violet-600",
  "bg-blue-600",
  "bg-cyan-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-pink-600",
  "bg-indigo-600",
];

function getAvatarColorClass(seed: string): string {
  const hash = seed.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length] ?? "bg-violet-600";
}

export function GuestSessionCard({
  info,
  onSignIn,
  variant = "prompt",
}: GuestSessionCardProps) {
  const colorClass = getAvatarColorClass(info.colorSeed);
  const initials = info.displayName.slice(0, 2).toUpperCase();

  if (variant === "code") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorClass} text-xs font-bold text-white`}
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{info.displayName}</p>
          <p className="text-xs text-slate-400">Гость · Только бесплатные модели</p>
        </div>
        <button
          type="button"
          onClick={onSignIn}
          className="ml-auto inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-violet-300/40 bg-violet-600/20 px-3 text-xs font-semibold text-violet-100 transition hover:border-violet-300/70 hover:bg-violet-600/40"
        >
          Войти
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorClass} text-sm font-black text-white`}
      >
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-white">{info.displayName}</p>
        <p className="text-xs text-slate-400">Гость · Только бесплатные модели</p>
      </div>
      <button
        type="button"
        onClick={onSignIn}
        className="inline-flex min-h-[44px] shrink-0 items-center rounded-lg border border-white/15 px-3 text-xs font-semibold text-slate-300 transition hover:border-white/30 hover:text-white"
      >
        Войти
      </button>
    </div>
  );
}
