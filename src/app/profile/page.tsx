"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";

interface ArenaStats {
  totalComparisons: number;
  totalResponses: number;
  totalVotes: number;
  lastActiveAt: string | null;
}

interface ProfileData {
  id: string;
  email: string | null;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  role: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

type PageState = "loading" | "unauthenticated" | "ready" | "not_found";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Derive avatar initials from profile
function getInitials(profile: ProfileData): string {
  if (profile.firstName || profile.lastName) {
    return ((profile.firstName?.[0] ?? "") + (profile.lastName?.[0] ?? "")).toUpperCase() || "?";
  }
  if (profile.displayName) return profile.displayName[0]?.toUpperCase() ?? "?";
  if (profile.email) return profile.email[0]?.toUpperCase() ?? "?";
  return "?";
}

export default function ProfilePage() {
  const [state, setState] = useState<PageState>("loading");
  const [profile, setProfile] = useState<ProfileData | null>(null);

  // Edit form
  const [displayName, setDisplayName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  // Arena stats
  const [stats, setStats] = useState<ArenaStats | null>(null);

  // Avatar upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // Sign out
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseClient();
      if (!supabase) { setState("unauthenticated"); return; }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { setState("unauthenticated"); return; }

      const res = await fetch("/api/profile");
      if (!res.ok) {
        setState(res.status === 401 ? "unauthenticated" : "not_found");
        return;
      }

      const json = (await res.json()) as { status: string; profile: ProfileData };
      setProfile(json.profile);
      setDisplayName(json.profile.displayName ?? "");
      setFirstName(json.profile.firstName ?? "");
      setLastName(json.profile.lastName ?? "");
      if (json.profile.avatarUrl) setAvatarPreview(json.profile.avatarUrl);
      setState("ready");

      // Load stats (non-blocking)
      fetch("/api/profile/stats")
        .then((r) => r.json())
        .then((s: { status: string; stats: ArenaStats }) => {
          if (s.status === "success") setStats(s.stats);
        })
        .catch(() => null);
    }
    load();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveMessage(null);
    setIsSaving(true);

    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, firstName, lastName }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setSaveMessage({ kind: "error", text: body.message ?? "Failed to save." });
    } else {
      setProfile((prev) =>
        prev ? { ...prev, displayName: displayName || null, firstName: firstName || null, lastName: lastName || null } : prev
      );
      setSaveMessage({ kind: "success", text: "Profile saved." });
    }
    setIsSaving(false);
  }

  async function handleAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setIsUploadingAvatar(true);

    // Client-side preview
    const reader = new FileReader();
    reader.onload = (e) => setAvatarPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const form = new FormData();
    form.append("file", file);

    const res = await fetch("/api/profile/avatar", { method: "POST", body: form });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setAvatarError(body.message ?? "Upload failed.");
      setAvatarPreview(profile?.avatarUrl ?? null);
    } else {
      const body = (await res.json()) as { avatarUrl: string };
      setAvatarPreview(body.avatarUrl);
      setProfile((prev) => prev ? { ...prev, avatarUrl: body.avatarUrl } : prev);
    }
    setIsUploadingAvatar(false);

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    setIsUploadingAvatar(true);

    await fetch("/api/profile/avatar", { method: "DELETE" });

    setAvatarPreview(null);
    setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev);
    setIsUploadingAvatar(false);
  }

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setIsSigningOut(true);
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <span className="text-sm text-slate-400">Загружаем профиль…</span>
      </main>
    );
  }

  if (state === "unauthenticated") {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-center">
        <h1 className="mb-4 text-2xl font-black text-white">Профиль</h1>
        <p className="mb-6 text-slate-400">Войдите, чтобы просмотреть профиль.</p>
        <Link
          href="/login"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500"
        >
          Войти
        </Link>
      </main>
    );
  }

  if (state === "not_found" || !profile) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-center">
        <h1 className="mb-4 text-2xl font-black text-white">Профиль не найден</h1>
        <Link href="/" className="text-sm text-slate-400 transition hover:text-white">← На главную</Link>
      </main>
    );
  }

  const planLabel = profile.plan === "premium" ? "Premium" : "Free";
  const roleLabel = profile.role === "admin" ? "Admin" : "User";

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Link className="text-sm text-slate-400 transition hover:text-white" href="/">← На главную</Link>
          <h1 className="mt-4 text-3xl font-black text-white">Профиль</h1>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          {isSigningOut ? "Выходим…" : "Выйти"}
        </button>
      </div>

      {/* Avatar section */}
      <section className="mb-6 flex items-center gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        {/* Avatar display */}
        <div className="relative shrink-0">
          {avatarPreview ? (
            <Image
              src={avatarPreview}
              alt="Avatar"
              width={72}
              height={72}
              className="h-18 w-18 rounded-full object-cover ring-2 ring-violet-500/40"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-violet-700 text-xl font-black text-white ring-2 ring-violet-500/40">
              {getInitials(profile)}
            </div>
          )}
          {isUploadingAvatar && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
              <svg className="h-5 w-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Avatar actions */}
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-semibold text-white">
            {profile.displayName ?? profile.email ?? "Пользователь"}
          </p>
          <p className="mb-3 text-xs text-slate-400">JPG, PNG или WEBP · Макс. 2 МБ</p>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
              type="file"
            />
            <button
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-violet-500/40 px-3 py-1.5 text-xs font-semibold text-violet-300 transition hover:border-violet-400 hover:text-violet-200 disabled:opacity-50"
            >
              {avatarPreview ? "Заменить" : "Загрузить"}
            </button>
            {avatarPreview && (
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={handleRemoveAvatar}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-50"
              >
                Удалить
              </button>
            )}
          </div>
          {avatarError && (
            <p className="mt-2 text-xs text-red-300">{avatarError}</p>
          )}
        </div>
      </section>

      {/* Arena stats */}
      {stats !== null && (
        <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Активность</h2>
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs text-slate-400">Сравнений</dt>
              <dd className="mt-1 text-2xl font-black text-white">{stats.totalComparisons}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Ответов</dt>
              <dd className="mt-1 text-2xl font-black text-white">{stats.totalResponses}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-400">Голосов</dt>
              <dd className="mt-1 text-2xl font-black text-white">{stats.totalVotes}</dd>
            </div>
          </dl>
          {stats.lastActiveAt && (
            <p className="mt-4 text-center text-xs text-slate-500">
              Последняя активность: {formatDate(stats.lastActiveAt)}
            </p>
          )}
        </section>
      )}

      {/* Account info */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Аккаунт</h2>
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate-400">Email</dt>
            <dd className="font-medium text-white">{profile.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Роль</dt>
            <dd className="font-medium text-white">{roleLabel}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">План</dt>
            <dd>
              <span className={profile.plan === "premium"
                ? "rounded-full bg-violet-600/20 px-2 py-0.5 text-xs font-semibold text-violet-300"
                : "rounded-full bg-slate-700/50 px-2 py-0.5 text-xs font-semibold text-slate-300"
              }>{planLabel}</span>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Регистрация</dt>
            <dd className="text-slate-300">{formatDate(profile.createdAt)}</dd>
          </div>
        </dl>
      </section>

      {/* Edit form */}
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Личные данные</h2>
        <form className="grid gap-4" onSubmit={handleSave}>
          <label className="grid gap-2 text-sm text-slate-300">
            Отображаемое имя
            <input
              className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
              maxLength={60}
              onChange={(e) => { setDisplayName(e.target.value); setSaveMessage(null); }}
              placeholder="Ваше публичное имя"
              type="text"
              value={displayName}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-2 text-sm text-slate-300">
              Имя
              <input
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
                maxLength={60}
                onChange={(e) => { setFirstName(e.target.value); setSaveMessage(null); }}
                placeholder="Иван"
                type="text"
                value={firstName}
              />
            </label>
            <label className="grid gap-2 text-sm text-slate-300">
              Фамилия
              <input
                className="rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
                maxLength={60}
                onChange={(e) => { setLastName(e.target.value); setSaveMessage(null); }}
                placeholder="Петров"
                type="text"
                value={lastName}
              />
            </label>
          </div>
          {saveMessage && (
            <p className={saveMessage.kind === "success"
              ? "rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200"
              : "rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
            }>{saveMessage.text}</p>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Сохраняем…" : "Сохранить"}
          </button>
        </form>
      </section>

      {/* Security section */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">Безопасность</h2>

        {/* Password reset */}
        <div className="flex items-center justify-between border-b border-white/5 pb-4 text-sm">
          <div>
            <p className="font-medium text-white">Сменить пароль</p>
            <p className="text-slate-400">Ссылка для смены придёт на ваш email.</p>
          </div>
          <Link
            href="/auth/reset-password"
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
          >
            Сменить
          </Link>
        </div>

        {/* Email change */}
        <EmailChangeForm currentEmail={profile.email} />
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// EmailChangeForm
// ---------------------------------------------------------------------------

function EmailChangeForm({ currentEmail }: { currentEmail: string | null }) {
  const [newEmail, setNewEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSending(true);

    const res = await fetch("/api/profile/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail }),
    });

    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) {
      setMessage({ kind: "error", text: body.message ?? "Failed to send." });
    } else {
      setMessage({ kind: "success", text: body.message ?? "Confirmation sent." });
      setNewEmail("");
    }
    setIsSending(false);
  }

  return (
    <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
      <p className="text-sm font-medium text-white">Изменить email</p>
      <p className="text-xs text-slate-400">
        Текущий: <span className="text-slate-300">{currentEmail ?? "—"}</span>.
        После отправки придут письма на оба адреса.
      </p>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-300/60"
          inputMode="email"
          onChange={(e) => { setNewEmail(e.target.value); setMessage(null); }}
          placeholder="new@example.com"
          type="email"
          value={newEmail}
        />
        <button
          type="submit"
          disabled={isSending || !newEmail}
          className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          {isSending ? "Отправляем…" : "Отправить"}
        </button>
      </div>
      {message && (
        <p className={message.kind === "success"
          ? "text-xs text-emerald-300"
          : "text-xs text-red-300"
        }>{message.text}</p>
      )}
    </form>
  );
}
