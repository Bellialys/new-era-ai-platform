import type { ArenaModel } from "@/types/arena";

export const arenaModels: ArenaModel[] = [
  {
    id: "balanced-model",
    name: "Model A",
    provider: "OpenRouter mock",
    role: "Balanced answer",
    description: "Сбалансированная модель для обычных задач Prompt Arena.",
    badge: "MVP default",
  },
  {
    id: "creative-model",
    name: "Model B",
    provider: "OpenRouter mock",
    role: "Creative answer",
    description: "Модель для более свободных, творческих и альтернативных ответов.",
    badge: "Creative",
  },
  {
    id: "critical-model",
    name: "Model C",
    provider: "OpenRouter mock",
    role: "Critical answer",
    description: "Модель для строгого анализа, критики и проверки слабых мест ответа.",
    badge: "Critical",
  },
];
