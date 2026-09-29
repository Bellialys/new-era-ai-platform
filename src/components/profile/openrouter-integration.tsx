"use client";

import { useEffect, useState } from "react";
import {
  loadOpenRouterIntegrationStatus,
  type OpenRouterIntegrationStatus,
} from "./openrouter-integration-loader";

type UiMessage = { kind: "success" | "error"; text: string } | null;

export function OpenRouterIntegration() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [integration, setIntegration] =
    useState<OpenRouterIntegrationStatus | null>(null);
  const [statusLoadError, setStatusLoadError] = useState<string | null>(null);
  const [statusReloadToken, setStatusReloadToken] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const result = await loadOpenRouterIntegrationStatus();
      if (!active) return;

      if (result.kind === "error") {
        setStatusLoadError(result.message);
        setIntegration(null);
      } else {
        setStatusLoadError(null);
        setEnabled(result.enabled);
        setIntegration(result.integration);
      }
      setLoading(false);

      const params = new URLSearchParams(window.location.search);
      const oauthResult = params.get("openrouter");
      const code = params.get("code");
      if (oauthResult === "connected") {
        setMessage({
          kind: "success",
          text:
            "OpenRouter подключён, ключ сохранён в зашифрованном виде. Arena использует server-side gateway и выбирает пользовательский credential только при активном funding source.",
        });
      } else if (oauthResult === "error") {
        setMessage({
          kind: "error",
          text:
            code === "OPENROUTER_ALREADY_CONNECTED"
              ? "OpenRouter уже подключён."
              : "Подключение OpenRouter не завершено. Попробуйте ещё раз.",
        });
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [statusReloadToken]);

  function retryStatusLoad() {
    setLoading(true);
    setStatusLoadError(null);
    setStatusReloadToken((value) => value + 1);
  }

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
  if (!enabled && !integration?.connected && !statusLoadError) return null;

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

      {statusLoadError && (
        <div className="mb-4 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          <p>{statusLoadError}</p>
          <button
            type="button"
            onClick={retryStatusLoad}
            className="mt-3 rounded-lg border border-red-300/30 px-3 py-1.5 text-xs font-semibold text-red-100 transition hover:border-red-200/60"
          >
            Повторить
          </button>
        </div>
      )}

      {integration?.connected && (
        <dl className="mb-4 grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Funding preference</dt>
            <dd className="text-right text-slate-200">
              {integration.fundingSource === "user_openrouter"
                ? "Ваш OpenRouter (подготовлен)"
                : "Платформа"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Безопасный отпечаток</dt>
            <dd className="font-mono text-xs text-slate-300">
              {integration.safeFingerprint ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-400">Последняя проверка</dt>
            <dd className="text-right text-xs text-slate-300">
              {integration.lastVerifiedAt
                ? new Date(integration.lastVerifiedAt).toLocaleString("ru-RU")
                : "—"}
            </dd>
          </div>
          <p className="mt-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-4 py-2.5 text-sm text-sky-200">
            OAuth и funding control-plane подключены к server-side gateway. Пользовательский
            credential используется только при активном funding source.
          </p>
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

      {!statusLoadError && (
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
      )}
    </section>
  );
}
