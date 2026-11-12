"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type SavedPrompt = {
  id: string;
  title: string;
  promptText: string;
  createdAt: string;
  updatedAt: string;
};
type ListResponse = { status: "success"; items: SavedPrompt[] };

async function responseError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === "object" && "message" in body &&
      typeof body.message === "string") {
    return body.message;
  }
  return "Ошибка запроса. Повторите попытку.";
}

export default function SavedPromptsPage() {
  const [items, setItems] = useState<SavedPrompt[]>([]);
  const [title, setTitle] = useState("");
  const [promptText, setPromptText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchItems = useCallback(async (): Promise<{ unauthorized: boolean; items: SavedPrompt[] }> => {
    const response = await fetch("/api/saved-prompts", { cache: "no-store" });
    if (response.status === 401) return { unauthorized: true, items: [] };
    if (!response.ok) throw new Error(await responseError(response));
    const result = (await response.json()) as ListResponse;
    return { unauthorized: false, items: result.items };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const result = await fetchItems();
        if (!active) return;
        setItems(result.items);
        setUnauthorized(result.unauthorized);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Ошибка загрузки.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [fetchItems]);

  function clearEditor() {
    setTitle("");
    setPromptText("");
    setEditingId(null);
  }

  async function refreshList() {
    const result = await fetchItems();
    setItems(result.items);
    setUnauthorized(result.unauthorized);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const trimmedTitle = title.trim();
    const trimmedPrompt = promptText.trim();
    if (trimmedTitle.length < 1 || trimmedTitle.length > 80 ||
        trimmedPrompt.length < 3 || trimmedPrompt.length > 8000) {
      setError("Название: 1–80 символов; запрос: 3–8000 символов.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(
        editingId ? "/api/saved-prompts/" + encodeURIComponent(editingId) : "/api/saved-prompts",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: trimmedTitle, promptText: trimmedPrompt }),
          cache: "no-store",
        }
      );
      if (!response.ok) throw new Error(await responseError(response));
      clearEditor();
      await refreshList();
      setNotice(editingId ? "Запрос обновлён." : "Запрос сохранён.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить запрос.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (confirmDeleteId !== id || busy) {
      setConfirmDeleteId(id);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/saved-prompts/" + encodeURIComponent(id), {
        method: "DELETE",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(await responseError(response));
      await refreshList();
      if (editingId === id) clearEditor();
      setNotice("Запрос удалён.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить запрос.");
    } finally {
      setConfirmDeleteId(null);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-8 border-b border-white/10 pb-6">
        <Link href="/arena" className="text-sm text-slate-400 hover:text-white">
          ← Prompt Arena
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">Сохранённые запросы</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Управляйте своими шаблонами: создавайте, просматривайте, изменяйте и удаляйте записи.
        </p>
      </header>

      {loading ? <p role="status" className="text-slate-300">Загрузка…</p> : null}
      {!loading && unauthorized ? (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-6">
          <p className="text-slate-200">Для работы с сохранёнными запросами нужен аккаунт.</p>
          <Link href="/login" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-500">
            Войти
          </Link>
        </section>
      ) : null}

      {!loading && !unauthorized ? (
        <>
          <section aria-labelledby="saved-prompt-editor" className="rounded-2xl border border-white/15 bg-white/5 p-5 sm:p-6">
            <h2 id="saved-prompt-editor" className="text-xl font-bold">
              {editingId ? "Изменить запрос" : "Новый запрос"}
            </h2>
            <form onSubmit={save} className="mt-5 space-y-4">
              <div>
                <label htmlFor="draft-title" className="mb-2 block text-sm text-slate-200">Название</label>
                <input id="draft-title" name="title" required maxLength={80} value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-white/20 bg-black/30 px-4 text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  placeholder="Например, Анализ кода" />
              </div>
              <div>
                <label htmlFor="draft-prompt" className="mb-2 block text-sm text-slate-200">Текст запроса</label>
                <textarea id="draft-prompt" name="promptText" required minLength={3} maxLength={8000}
                  rows={5} value={promptText} onChange={(e) => setPromptText(e.target.value)}
                  className="w-full rounded-xl border border-white/20 bg-black/30 px-4 py-3 text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                  placeholder="Введите текст для сохранения…" />
                <p className="mt-1 text-right text-xs text-slate-400">{promptText.length}/8000</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <button type="submit" disabled={busy}
                  className="min-h-11 rounded-full bg-violet-600 px-6 text-sm font-semibold text-white hover:bg-violet-500 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">
                  {busy ? "Сохранение…" : editingId ? "Сохранить изменения" : "Создать запись"}
                </button>
                {editingId ? (
                  <button type="button" disabled={busy} onClick={clearEditor}
                    className="min-h-11 rounded-full border border-white/20 px-5 text-sm text-white hover:bg-white/10">
                    Отменить
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section aria-labelledby="saved-prompt-list" className="mt-8">
            <h2 id="saved-prompt-list" className="mb-4 text-xl font-bold">Мои записи</h2>
            {items.length === 0 ? (
              <p className="rounded-xl border border-white/10 p-5 text-sm text-slate-400">
                Сохранённых запросов пока нет.
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-300">
                      {item.promptText}
                    </p>
                    <p className="mt-3 text-xs text-slate-500">
                      Обновлено: {new Date(item.updatedAt).toLocaleString("ru-RU")}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" disabled={busy} onClick={() => {
                        setTitle(item.title);
                        setPromptText(item.promptText);
                        setEditingId(item.id);
                        setConfirmDeleteId(null);
                        setNotice(null);
                      }} className="min-h-11 rounded-full border border-violet-400/40 px-5 text-sm text-violet-100 hover:bg-violet-500/20">
                        Изменить
                      </button>
                      <button type="button" disabled={busy} onClick={() => void remove(item.id)}
                        aria-label={confirmDeleteId === item.id ? "Подтвердить удаление " + item.title : "Удалить " + item.title}
                        className="min-h-11 rounded-full border border-red-400/30 px-5 text-sm text-red-200 hover:bg-red-500/10">
                        {confirmDeleteId === item.id ? "Подтвердить удаление" : "Удалить"}
                      </button>
                      {confirmDeleteId === item.id ? (
                        <button type="button" disabled={busy} onClick={() => setConfirmDeleteId(null)}
                          className="min-h-11 px-3 text-sm text-slate-300 hover:text-white">
                          Отмена
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
      {error ? <p role="alert" className="mt-5 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">{error}</p> : null}
      {notice ? <p role="status" className="mt-5 rounded-xl border border-emerald-400/30 p-4 text-sm text-emerald-200">{notice}</p> : null}
    </main>
  );
}
