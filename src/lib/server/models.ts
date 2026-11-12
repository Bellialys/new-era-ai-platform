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

// Curated public free OpenRouter text/chat catalog refreshed on 2026-11-09.
// Models with research-only/special terms, poor current availability, or a
// multimodal-specialist role are intentionally kept out of the anonymous
// fallback catalog even if their provider slug still exists.
// Order matters: the UI preselects the first models.
export const ALLOWED_MODELS: LocalArenaModel[] = [
  // --- General-purpose defaults ---
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

  // --- Fast / reasoning ---
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
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    role: "Reasoning / experimental",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Бесплатная reasoning-модель NVIDIA; доступность free endpoint может быть нестабильной, поэтому она не используется как default.",
  },

  // --- Coding ---
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
    id: "xingchen-agi/xing4.0-29b-a4b:free",
    name: "Xing4.0 29B A4B",
    role: "Engineering / agentic",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная инженерная модель XingChen для задач программирования, многошагового планирования и работы с инструментами.",
  },

  // --- Compact / extraction ---
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LFM 2.5 2.6B",
    role: "Fast / extraction / RAG",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Бесплатная компактная LiquidAI-модель для extraction, RAG и быстрых agent workflows.",
  },
];
