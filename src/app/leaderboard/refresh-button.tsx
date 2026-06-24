"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  function handleRefresh() {
    setLoading(true);
    router.refresh();
    setTimeout(() => setLoading(false), 800);
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={loading}
      className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-slate-300 transition hover:border-white/20 hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? "Обновление…" : "↻ Обновить"}
    </button>
  );
}
