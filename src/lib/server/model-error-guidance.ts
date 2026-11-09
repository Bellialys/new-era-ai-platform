/**
 * Safe, actionable model failure messages for public SSE responses.
 * Never forward provider raw messages, account details, or credentials.
 */
export function publicModelFailureMessage(errorCode: string): string {
  switch (errorCode.toUpperCase()) {
    case "RATE_LIMIT":
    case "429":
      return "Достигнут лимит запросов к этой модели. Бесплатные квоты OpenRouter могут быть общими; повторите позже или выберите другую модель.";
    case "404":
    case "MODEL_NOT_FOUND":
    case "NO_ENDPOINTS_FOUND":
      return "Модель сейчас недоступна у провайдера. Выберите другую модель; её каталог может быть устаревшим.";
    case "TIMEOUT":
    case "NETWORK_ERROR":
    case "504":
      return "Провайдер не ответил вовремя. Повторите позже или выберите другую модель.";
    case "INSUFFICIENT_CREDITS":
    case "402":
      return "Лимит средств или квота ключа OpenRouter исчерпаны. Проверьте финансирование аккаунта.";
    case "AUTH_ERROR":
    case "401":
    case "403":
    case "AI_CREDENTIAL_UNAVAILABLE":
      return "Проблема с доступом к OpenRouter. Требуется проверка серверного ключа или подключения аккаунта.";
    case "INVALID_RESPONSE":
      return "Провайдер вернул пустой или некорректный ответ. Попробуйте другую модель.";
    default:
      return "Модель не вернула ответ. Повторите запрос позже или выберите другую модель.";
  }
}
