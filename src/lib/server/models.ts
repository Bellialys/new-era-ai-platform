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

// Curated set of free OpenRouter text/chat model keys mirrored by the latest
// forward-only catalog migration. Run `npm run models:verify` before public
// deploy or whenever this fallback list changes.
// Order matters: the UI preselects the first models.
export const ALLOWED_MODELS: LocalArenaModel[] = [
  // --- General-purpose (default selection) ---
  {
    id: "z-ai/glm-5.2:free",
    name: "GLM 5.2",
    role: "Сильная general-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free",
    description: "Бесплатная универсальная модель Z.AI для сложных инструкций и общих задач.",
  },
  {
    id: "thinkingmachines/inkling:free",
    name: "Inkling",
    role: "Сильная reasoning-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Бесплатная модель Thinking Machines для рассуждений и многошаговых задач.",
  },
  {
    id: "thinkingmachines/inkling-small:free",
    name: "Inkling Small",
    role: "Быстрое рассуждение",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Бесплатная компактная модель Thinking Machines для быстрых рассуждений.",
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    role: "Быстрая agentic-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Бесплатная быстрая модель NVIDIA для agentic-сценариев и общих задач.",
  },

  // --- Reasoning ---
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    role: "Глубокое рассуждение",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Бесплатная reasoning-модель NVIDIA 550B с контекстом 1M.",
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    name: "Nemotron 3 Super",
    role: "Рассуждение",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Бесплатная reasoning-модель NVIDIA 120B с контекстом 262K.",
  },
  {
    id: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    name: "Nemotron 3 Nano Omni",
    role: "Компактное рассуждение",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Reasoning",
    description: "Бесплатная компактная omni reasoning-модель NVIDIA 30B.",
  },
  {
    id: "google/gemma-4-31b-it:free",
    name: "Gemma 4 31B",
    role: "Открытая general-модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free",
    description: "Бесплатная модель Google Gemma 4 для общих ответов, контекст 262K.",
  },
  {
    id: "google/gemma-4-26b-a4b-it:free",
    name: "Gemma 4 26B A4B",
    role: "Открытая general-модель (MoE)",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free",
    description: "Бесплатная MoE-модель Google Gemma 4 — быстрее за счёт активных 4B параметров.",
  },
  // --- Coding ---
  {
    id: "poolside/laguna-s-2.1:free",
    name: "Laguna S 2.1",
    role: "Coding / code-oriented",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная code-oriented модель Poolside для сложных задач программирования.",
  },
  {
    id: "poolside/laguna-xs-2.1:free",
    name: "Laguna XS 2.1",
    role: "Coding / code-oriented",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная компактная code-oriented модель Poolside для быстрых coding-сравнений.",
  },
  {
    id: "cohere/north-mini-code:free",
    name: "North Mini Code",
    role: "Coding / code-oriented",
    provider: "openrouter",
    supportsCode: true,
    badge: "Free Coding",
    description: "Бесплатная компактная модель Cohere, оптимизированная для программирования.",
  },

  // --- Compact ---
  {
    id: "liquid/lfm-2.5-2.6b:free",
    name: "LFM 2.5 2.6B",
    role: "Сверхбыстрая лёгкая модель",
    provider: "openrouter",
    supportsCode: false,
    badge: "Free Fast",
    description: "Бесплатная компактная модель LiquidAI 2.6B для быстрых ответов.",
  },
];
