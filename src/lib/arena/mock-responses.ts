import type { ArenaModel, ArenaResponse } from "@/types/arena";

type BuildMockResponsesParams = {
  prompt: string;
  selectedModels: ArenaModel[];
};

function buildResponseText(prompt: string, model: ArenaModel, index: number): string {
  const cleanPrompt = prompt.trim();

  const openings = [
    "Я бы начал с короткого анализа задачи и выделил главное требование.",
    "Я бы предложил альтернативный подход и сравнил несколько вариантов решения.",
    "Я бы сначала проверил риски, ограничения и возможные слабые места решения.",
  ];

  const recommendations = [
    "Для MVP лучше выбрать самый простой рабочий путь, чтобы быстро получить проверяемый результат.",
    "После первой рабочей версии можно постепенно улучшать интерфейс, хранение истории и качество сравнения.",
    "Важно не добавлять сложные режимы раньше времени, потому что они увеличивают риск поломки базовой Prompt Arena.",
  ];

  return [
    `${model.name} отвечает в режиме: ${model.role}.`,
    `Задача пользователя: "${cleanPrompt}".`,
    openings[index % openings.length],
    recommendations[index % recommendations.length],
    "В реальной версии этот текст будет заменён ответом AI-модели через backend и OpenRouter API.",
  ].join("\n\n");
}

export function buildMockResponses({ prompt, selectedModels }: BuildMockResponsesParams): ArenaResponse[] {
  return selectedModels.map((model, index) => ({
    id: `${model.id}-response-${Date.now()}-${index}`,
    modelId: model.id,
    modelName: model.name,
    modelRole: model.role,
    status: "success",
    text: buildResponseText(prompt, model, index),
    latencyMs: 1200 + index * 430,
  }));
}
