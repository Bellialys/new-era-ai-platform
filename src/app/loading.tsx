export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-violet-400"
        aria-hidden="true"
      />
      <p className="text-sm text-slate-400">Загрузка…</p>
    </main>
  );
}
