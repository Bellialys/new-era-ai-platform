/**
 * Small presentation helpers shared by the history list and detail views.
 * Pure formatting — safe to import into client components.
 */

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function modeLabel(slug: string): string {
  if (slug === "prompt-arena") return "Prompt Arena";
  if (slug === "code-arena") return "Code Arena";
  return slug;
}

const STATUS_LABELS: Record<string, string> = {
  completed: "Завершено",
  partial: "Частично",
  failed: "Ошибка",
  pending: "В очереди",
  running: "Выполняется",
  cancelled: "Отменено",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Russian plural for "модель / модели / моделей". */
export function pluralModels(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "модель";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "модели";
  return "моделей";
}
