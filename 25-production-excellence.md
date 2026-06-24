# 25 - Production Excellence

## Статус

```text
Status: active
# эти правила действуют для всех этапов, начиная с v1.7
```

## Назначение

Дополнительный свод стандартов уровня production-grade, обязательный к учёту при разработке любой фичи. Расширяет `23-codex-quality-rules.md` и `24-codex-active-rule-set.md`.

Этот документ не заменяет roadmap и project state. Он задаёт operational baseline: как проект должен проектироваться, проверяться, выпускаться и сопровождаться, если цель — международный уровень качества.

## 1. Observability (наблюдаемость)

- Каждый запрос должен иметь трассировочный идентификатор (`request-id`).
- Критические операции логируются с уровнем `info`.
- Ошибки логируются с контекстом и уровнем `error`.
- Рекомендация: использовать структурированное логирование (JSON).
- Метрики должны разделять latency, error rate, saturation и external-provider failures.
- Для AI/provider-интеграций логировать route, request id, provider/model key, safe error code, latency и retry/circuit-breaker outcome без prompt body, cookies, auth headers и секретов.

## 2. Continuous Integration / Deployment

- CI должен прогонять `typecheck`, `lint`, `build`, `test` (если есть) на каждый push в `main` и PR.
- Деплой автоматический после прохождения CI, если настроен Vercel.
- При падении CI разработка останавливается до исправления.
- Красный CI после merge в основную ветку требует немедленного fix-commit или rollback/forward-fix решения.
- Release notes должны фиксировать: что изменилось, какие проверки прошли, какие риски остались и какой rollback path доступен.

## 3. Chaos Engineering (устойчивость)

- Код должен корректно обрабатывать таймауты, разрывы соединений, ошибки сторонних сервисов.
- Внешние вызовы должны иметь retry с exponential backoff и circuit breaker, если повтор безопасен и не создаёт дублирующий side effect.
- Не доверять внешним сервисам: всегда проверять ответы.
- Любой provider timeout должен возвращать controlled error contract, а не raw exception.
- Для критичных маршрутов фиксировать fallback strategy: degrade gracefully, retry later, partial response или explicit unavailable state.

## 4. Data Privacy & Compliance

- Никакие PII (персональные данные) не должны попадать в логи.
- Хранить только минимально необходимые данные.
- Соблюдать GDPR: пользователь должен иметь возможность запросить удаление своих данных.
- Prompt, response, email, avatar URL, auth identifiers и guest identifiers считаются чувствительными данными и требуют минимизации доступа.
- Любой экспорт, debug dump или support workflow должен проходить sanitization перед передачей за пределы production-boundary.

## 5. Capacity Planning

- Архитектура должна предполагать горизонтальное масштабирование (stateless).
- Избегать глобальных блокировок; использовать optimistic concurrency.
- При проектировании баз данных учитывать рост до 10M записей.
- Для списков обязательны pagination, backend limit и индекс под частый `WHERE` / `ORDER BY`.
- Для дорогих AI/API операций обязательны rate limit, cost visibility и server-side enforcement.
- Решения должны оцениваться с расчётом на 1M+ пользователей, даже если первая реализация остаётся MVP.

## 6. Security and Threat Modeling

- Для новых API, auth, billing, admin, data-export и runner функций проводить мини threat model по STRIDE.
- Security review должен учитывать OWASP ASVS, OWASP Top 10 for LLM Applications и NIST SSDF как ориентиры зрелости.
- Любые secrets, service-role keys, provider tokens и internal credentials запрещено передавать во frontend, логи, markdown-примеры и screenshots.
- Для новых Supabase user-facing таблиц обязательны RLS и политики в той же миграции; подробное правило — `23-codex-quality-rules.md`, раздел `8.1 Row Level Security (RLS)`.
- Admin/audit endpoints должны иметь explicit authorization и безопасный DTO whitelist.
- User-generated code never runs inside the app server process; runner isolation, auth, timeouts и rate limits обязательны.

## 7. Performance and Cost

- Новые endpoints должны иметь оценку latency budget, потенциальных N+1 запросов, индексов и внешних provider calls.
- Для UI-изменений проверять влияние на first-load JS bundle, hydration и mobile performance.
- Для AI-интеграций фиксировать max tokens, timeout, retry policy и cost-risk boundary.
- Если добавляется dependency, нужно оценить bundle/runtime impact и объяснить, почему существующих средств недостаточно.

## 8. Release and Rollback

- Production release должен иметь проверенный path: Local -> Preview -> Production.
- Если затронута база данных, rollback plan должен быть forward-fix friendly; destructive rollback без подтверждения запрещён.
- Перед опасными production DB-операциями фиксировать backup/PITR readiness или причину, почему операция безопасна без отдельного backup.
- После релиза проверять health/smoke endpoints и основные user journeys, затронутые изменением.

## 9. AI Safety and Provider Governance

- Все AI-запросы идут только через backend route handlers.
- Для каждого provider route должен быть safe error contract, timeout и ограничение входных данных.
- Prompt privacy должна быть явной: что отправляется provider, что сохраняется, что логируется.
- Новые модели добавляются только после проверки model id, access level, pricing/cost risk и fallback behavior.
- Любая функция, повышающая стоимость или риск abuse, требует лимитов и observability до public release.

### 9.1 AI Output Sanitization — защита от Insecure Output Handling

Все ответы, полученные от OpenRouter, Judge Mode, Prompt Arena, Multi Model Battle, AI Team Mode, Code Arena и будущих AI/Code Runner компонентов, считаются Untrusted Input.

AI-generated output нельзя напрямую вставлять в DOM, рендерить как доверенный HTML или использовать как исполняемый код.

Обязательные требования:

- Любой Markdown из AI-ответов на фронтенде должен проходить через безопасный Markdown pipeline и HTML sanitization.

- Если используется HTML-rendering для Markdown, он обязан проходить через DOMPurify или эквивалентный sanitizer с запрещением:
  - `<script>`;
  - inline event handlers вида `onClick`, `onError`, `onLoad` и любых `on*`;
  - `javascript:` URI;
  - `data:` URI, кроме явно разрешённых безопасных случаев;
  - `iframe`;
  - `object`;
  - `embed`;
  - `form`;
  - dangerous SVG/MathML payloads, если они не нужны продукту.

- По умолчанию AI-output должен рендериться как текст, а не как HTML.

- Для Code Arena UI и любых AI-generated code blocks код должен отображаться только внутри `<pre><code>` или эквивалентного safe code viewer.

- AI-generated code нельзя автоматически исполнять в браузере, Node.js, shell, database console или server runtime без отдельного sandbox-дизайна, лимитов и approval flow.

- Подсветка кода должна использовать безопасный highlighter без исполнения кода. Предпочтительно использовать server-side highlighting, например `shiki`, либо другой безопасный static highlighter.

- AI-сгенерированные URL должны проходить валидацию:
  - разрешены только `http:` и `https:`;
  - `javascript:`, `data:`, `file:`, `blob:` блокируются по умолчанию;
  - внешние ссылки должны открываться безопасно;
  - phishing-like и suspicious links не должны получать повышенное доверие в UI.

- AI-сгенерированные изображения, iframe, embeds и media content блокируются по умолчанию и разрешаются только через whitelist доверенных доменов.

- Если AI-ответ сохраняется в БД, он должен храниться и обрабатываться как tainted content. Перед возвратом клиенту или рендером он обязан проходить server-side validation / sanitization или безопасное output encoding.

- Не считать БД trusted boundary. Сохранённый AI-output остаётся недоверенным даже после записи в database.

- Judge Mode verdict, который влияет на voting UI, leaderboard, score, badges или model ranking, обязан проходить строгую Zod-схему с whitelist полей.

- Любые model-generated structured outputs должны валидироваться через schema validation до использования в бизнес-логике.

- Любые AI-generated labels, titles, descriptions, explanations, verdicts и comments должны безопасно кодироваться при выводе в UI.

- Любая будущая функция, которая позволяет AI-output влиять на UI state, voting, ranking, payments, permissions или user actions, требует отдельного security review.

Минимальные требования к Judge Mode structured output:

- Разрешены только ожидаемые поля.
- Неизвестные поля должны отбрасываться.
- Типы должны быть строгими.
- Score/rating должен иметь min/max limits.
- Verdict/status должен быть enum.
- HTML внутри verdict запрещён.
- Markdown внутри verdict разрешён только после sanitization.
- Любое объяснение модели отображается как недоверенный текст.

Примеры недопустимого поведения:

- Рендерить AI Markdown через `dangerouslySetInnerHTML` без sanitization.
- Показывать AI-generated HTML как trusted HTML.
- Исполнять AI-generated JavaScript.
- Автоматически запускать AI-generated shell commands.
- Подставлять AI-generated SQL в database query.
- Использовать AI-generated URL без проверки protocol/domain.
- Разрешать iframe/embed из ответа модели без whitelist.
- Принимать Judge Mode JSON без Zod validation.
- Считать данные из БД безопасными только потому, что они уже сохранены.

Self-review для AI-output изменений:

Перед merge разработчик обязан проверить:

- Есть ли новый путь, где AI-output попадает в UI.
- Есть ли новый путь, где AI-output сохраняется в БД.
- Есть ли новый путь, где AI-output влияет на голосование, рейтинг или leaderboard.
- Используется ли sanitization / output encoding.
- Нет ли `dangerouslySetInnerHTML` без DOMPurify или эквивалентного sanitizer.
- Нет ли исполнения AI-generated code.
- Есть ли Zod validation для structured output.
- Есть ли whitelist для URL/media/embed.
- Проходят ли `npm run state:check` и `npm run docs:check`.

## 10. Evidence and Reporting

- Каждое значимое решение должно иметь explanation: почему выбран этот подход, какие альтернативы были рассмотрены и какие риски приняты.
- Для сложных задач нужен execution report по этапам: research, analysis, design, implementation, tests, security/performance review, docs, commit/CI status.
- Если проверка заблокирована env, доступами или внешним сервисом, это фиксируется как blocked/unverified, а не как pass.
- Итоговый отчёт должен перечислять: изменённые файлы, commit hashes, пройденные проверки, заблокированные проверки, known risks и следующие улучшения.

## Авторитетные ориентиры

- OWASP ASVS: https://owasp.org/www-project-application-security-verification-standard/
- OWASP Cross Site Scripting Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html
- OWASP DOM based XSS Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/DOM_based_XSS_Prevention_Cheat_Sheet.html
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- OWASP Threat Modeling: https://owasp.org/www-community/Threat_Modeling_Process
- NIST SSDF SP 800-218: https://csrc.nist.gov/pubs/sp/800/218/final
- Google SRE SLO: https://sre.google/sre-book/service-level-objectives/
- W3C WCAG 2.1: https://www.w3.org/TR/WCAG21/
- OpenAPI Specification: https://swagger.io/specification/
- Supabase backups and PITR: https://supabase.com/docs/guides/platform/backups
- Next.js bundle analysis: https://nextjs.org/docs/app/guides/package-bundling

## Минимальный checklist применения

```text
[ ] request-id / logging impact понятен
[ ] CI / release impact понятен
[ ] timeout / retry / fallback path описан
[ ] privacy impact и PII-in-logs risk проверены
[ ] capacity impact до 1M+ пользователей оценён
[ ] threat model / OWASP review выполнены, если применимо
[ ] AI-generated output обработан как Untrusted Input по разделу 9.1, если применимо
[ ] performance / cost impact оценены, если применимо
[ ] rollback / forward-fix path понятен
[ ] финальный отчёт содержит evidence и known risks
```
