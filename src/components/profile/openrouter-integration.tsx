"use client";

import { useEffect, useState } from "react";

type IntegrationStatus = {
  connected: boolean;
  credentialId: string | null;
  credentialStatus: string | null;
  safeFingerprint: string | null;
  lastVerifiedAt: string | null;
  fundingSource: "platform" | "user_openrouter";
};

type StatusResponse = {
  status: "success";
  enabled: boolean;
  integration: IntegrationStatus;
};

type UiMessage = { kind: "success" | "error"; text: string } | null;

export function OpenRouterIntegration() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [integration, setIntegration] = useState<IntegrationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  async function loadStatus() {
    try {
      const response = await fetch("/api/integrations/openrouter", {
        cache: "no-store",
      });
      if (!response.ok) {
        setIntegration(null);
        return;
      }
      const body = (await response.json()) as StatusResponse;
      setEnabled(body.enabled);
      setIntegration(body.integration);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStatus();

    const params = new URLSearchParams(window.location.search);
    const result = params.get("openrouter");
    const code = params.get("code");
    if (result === "connected") {
      setMessage({
        kind: "success",
        text: "OpenRouter подключён. Для AI-запросов выбран ваш OpenRouter аккаунт.",
      });
    } else if (result === "error") {
      setMessage({
        kind: "error",
        text:
          code === "OPENROUTER_ALREADY_CONNECTED"
            ? "OpenRouter уже подключён."
            : "Подключение OpenRouter не завершено. Попробуйте ещё раз.",
      });
    }
  }, []);

  async function connect() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/openrouter/connect", {
        method: "POST",
      });
      const body = (await response.json().catch(() => ({}))) as {
        authorizationUrl?: string;
        message?: string;
      };
      if (!response.ok || !body.authorizationUrl) {
        throw new Error(body.message ?? "Не удалось начать подключение OpenRouter.");
      }
      window.location.assign(body.authorizationUrl);
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Не удалось начать подключение OpenRouter.",
      });
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/integrations/openrouter", {
        method: "DELETE",
      });
      const body = (await response.json().catch(() => ({}))) as {
        message?: string;
      };
      if (!response.ok) {
        throw new Error(body.message ?? "Не удалось отключить OpenRouter.");
      }

      setIntegration((current) =>
        current
          ? {
              ...current,
              connected: false,
              credentialStatus: "revoked",
              fundingSource: "platform",
            }
          : current
      );
      setMessage({
        kind: "success",
        text:
          "OpenRouter отключён. Активная зашифрованная копия ключа New Era удалена; сам ключ остаётся под вашим контролем в OpenRouter.",
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof Error
            ? error.message
            : "Не удалось отключить OpenRouter.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return null;
  if (!enabled && !integration?.connected) return null;

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            OpenRouter
          </h2>
          <p className="mt-2 text-sm text-slate-300">
            Подключите свой OpenRouter аккаунт через OAuth PKCE. New Era не показывает
            и не хранит ключ в открытом виде.
          </p>
        </div>
        {integration?.connected ? (
          <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
            Подключён
          </span>
        ) : (
          <span className="rounded-full bg-slate-700/50 px-2.5 py-1 text-xs font-semibold text-slate-300">
            Не подключён
          </span>
        )}
      </div>

      {integration?.connected && (
        <dl className="mb-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Источник оплаты</dt>
            <dd className="text-right text-slate-200">Ваш OpenRouter</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Безопасный отпечаток</dt>
            <dd className="font-mono text-xs text-slate-300">
              {integration.safeFingerprint ?? "—"}
            </dd>
          </div>
        </dl>
      )}

      {!enabled && integration?.connected && (
        <p className="mb-4 rounded-xl border border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
          Новые подключения временно выключены, но вы можете удалить сохранённую
          копию ключа.
        </p>
      )}

      {message && (
        <p
          className={
            message.kind === "success"
              ? "mb-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200"
              : "mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {integration?.connected ? (
          <button
            type="button"
            disabled={busy}
            onClick={disconnect}
            className="rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-200 transition hover:border-red-300/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Отключаем…" : "Отключить OpenRouter"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || !enabled}
            onClick={connect}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Переходим…" : "Подключить OpenRouter"}
          </button>
        )}
      </div>
    </section>
  );
}
