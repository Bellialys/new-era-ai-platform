/**
 * Hardcoded model list — the offline fallback for the model catalog.
 *
 * In v2.0.0-alpha.1 the live catalog is read from Supabase (see model-catalog.ts). This
 * list is used only when Supabase is not configured or the `models` table is
 * empty, so the app still works without a database.
 *
 * Live ID verification is handled by `npm run models:verify`.
 */

import type { ArenaModel } from "@/types/arena";

export type LocalArenaModel = ArenaModel & {
  /** Server-side capability metadata used when Supabase catalog is unavailable. */
  supportsCode: boolean;
};

// Curated free OpenRouter text fallback, reviewed on 2026-11-16.
// First two have the most recent confirmed successful model_responses telemetry.
// Other provider-listed entries must not be confused with successful live inference.
// Order matters: the UI preselects the first two models.
export const ALLOWED_MODELS: LocalArenaModel[] = [
  {
    id: "cohere/north-mini-code:free",
    name: "North Mini Code",
    role: "Coding / agentic",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная Cohere-модель для генерации кода, terminal-задач и agentic software engineering.",
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots3-Note Preview",
    role: "Coding / reasoning",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная coding/reasoning-модель Dots Studio. По данным OpenRouter, предложение действует до 31.12.2026.",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B A4B",
    role: "Основная general-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free",
    description: "Бесплатная мультимодальная MoE-модель Google Gemma 4 для общих задач и структурированных ответов.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    role: "Сильная general-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free",
    description: "Бесплатная мультимодальная Gemma 4 31B для reasoning, документов и общих задач.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    role: "Быстрая agentic-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Бесплатная быстрая NVIDIA-модель с большим контекстом для agentic и general-сценариев.",
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    role: "Reasoning / long context",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Дополнительная бесплатная модель NVIDIA. Provider-listed; реальный ответ через ключ проекта ещё не проверен. Не отправляйте конфиденциальные данные: NVIDIA ведёт журналирование.",
  },
  {
    id: "recursive/flint-v1.0:free",
    name: "Recursive Flint v1.0",
    role: "Coding / agentic",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Дополнительная бесплатная coding-модель Recursive. Provider-listed; реальный ответ через ключ проекта ещё не проверен.",
  },
  {
    id: "liquid/lfm-3-1.7b:free",
    name: "LFM3 1.7B",
    role: "Fast / structured outputs",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Дополнительная бесплатная компактная модель Liquid. Provider-listed; реальный ответ через ключ проекта ещё не проверен. Провайдер может сохранять запросы и использовать их для обучения.",
  },
];
