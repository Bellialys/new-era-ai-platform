# Автоматическое исправление H1-H3 из файла 28-documentation-audit-fresh.md
# Запускать из корня репозитория new-era-ai-platform

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Replace-RequiredText {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$OldText,
        [Parameter(Mandatory = $true)][string]$NewText,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Test-Path $Path)) {
        throw "Файл не найден: $Path"
    }

    $content = [System.IO.File]::ReadAllText($Path)

    if ($content.Contains($NewText)) {
        Write-Host "OK: уже исправлено - $Label"
        return
    }

    if (-not $content.Contains($OldText)) {
        throw "Не найден старый фрагмент для замены: $Label"
    }

    $content = $content.Replace($OldText, $NewText)
    [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "OK: исправлено - $Label"
}

function Add-TextAfterOnce {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$AnchorText,
        [Parameter(Mandatory = $true)][string]$TextToAdd,
        [Parameter(Mandatory = $true)][string]$Label
    )

    if (-not (Test-Path $Path)) {
        throw "Файл не найден: $Path"
    }

    $content = [System.IO.File]::ReadAllText($Path)

    if ($content.Contains($TextToAdd)) {
        Write-Host "OK: уже добавлено - $Label"
        return
    }

    if (-not $content.Contains($AnchorText)) {
        throw "Не найдено место для вставки: $Label"
    }

    $content = $content.Replace($AnchorText, $AnchorText + "`r`n" + $TextToAdd)
    [System.IO.File]::WriteAllText($Path, $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "OK: добавлено - $Label"
}

# H1 - 03-tools-and-sites.md: документация хранится в корне, не в docs
$old03Structure = @'
```text
new-era-ai/
  README.md
  docs/
    00-readme.md
    01-idea.md
    02-project-plan.md
    03-tools-and-sites.md
    04-mvp-scope.md
    05-user-roles.md
    06-project-modes.md
    07-architecture.md
    08-database.md
    09-api-structure.md
    10-ui-pages.md
    11-ai-models.md
    12-security-and-env.md
    13-deployment.md
    14-roadmap.md
    15-changelog.md
    16-decisions.md
    17-code-arena-spec.md
    18-team-mode-spec.md
  src/
    app/
    components/
    lib/
    types/
  .gitignore
  package.json
```
'@

$new03Structure = @'
```text
new-era-ai-platform/
  README.md
  00-readme.md
  01-idea.md
  02-project-plan.md
  03-tools-and-sites.md
  04-mvp-scope.md
  05-user-roles.md
  06-project-modes.md
  07-architecture.md
  08-database.md
  09-api-structure.md
  10-ui-pages.md
  11-ai-models.md
  12-security-and-env.md
  13-deployment.md
  14-roadmap.md
  15-changelog.md
  16-decisions.md
  17-code-arena-spec.md
  18-team-mode-spec.md
  19a-nextjs-setup.md
  AGENTS.md
  public/
  src/
    app/
    components/
    lib/
    types/
  .env.example
  .gitignore
  package.json
```
'@

Replace-RequiredText -Path "03-tools-and-sites.md" -OldText $old03Structure -NewText $new03Structure -Label "03: структура репозитория без docs"

Replace-RequiredText -Path "03-tools-and-sites.md" `
    -OldText "git add docs/03-tools-and-sites.md`r`n# добавляет изменённый файл инструментов в commit" `
    -NewText "git add 03-tools-and-sites.md`r`n# добавляет изменённый файл инструментов в commit" `
    -Label "03: git add без docs"

# H1 - 05-user-roles.md: команда git add без docs
Replace-RequiredText -Path "05-user-roles.md" `
    -OldText "git add docs/05-user-roles.md`r`n# добавляет исправленный файл с ролями пользователей в подготовку к commit" `
    -NewText "git add 05-user-roles.md`r`n# добавляет исправленный файл с ролями пользователей в подготовку к commit" `
    -Label "05: git add без docs"

# H1 - 07-architecture.md: документация хранится в корне
Replace-RequiredText -Path "07-architecture.md" `
    -OldText "docs/`r`n# документация проекта" `
    -NewText "00-readme.md ... 28-documentation-audit-fresh.md`r`n# документация проекта хранится в корне репозитория" `
    -Label "07: структура документации без docs"

Replace-RequiredText -Path "07-architecture.md" `
    -OldText "mkdir components lib types docs`r`n# создать основные папки проекта" `
    -NewText "mkdir components lib types`r`n# создать основные папки проекта без папки docs, потому что документация хранится в корне" `
    -Label "07: mkdir без docs"

# H3 - 08-database.md: modelIds являются UUID из таблицы models
$old08Allowlist = @'
Frontend показывает только модели из allowlist.
# пользователь не вводит model ID вручную

Frontend отправляет model_key на backend.
# это технический идентификатор модели

Backend проверяет model_key в таблице models.
# настоящая защита находится на сервере

Если модели нет в models или is_active = false, запрос отклоняется.
# контроль расходов и безопасности
'@

$new08Allowlist = @'
Frontend показывает только модели из allowlist.
# пользователь выбирает модель из списка, а не вводит OpenRouter model ID вручную

Frontend отправляет на backend modelIds.
# это массив UUID из таблицы models, то есть значения models.id

Backend проверяет каждый modelId в таблице models.
# настоящая защита находится на сервере

Backend получает model_key из найденной записи models.
# model_key используется только на backend для вызова OpenRouter

Если модели нет в models или is_active = false, запрос отклоняется.
# контроль расходов и безопасности
'@

Replace-RequiredText -Path "08-database.md" -OldText $old08Allowlist -NewText $new08Allowlist -Label "08: правило modelIds вместо model_key с frontend"

$old08SelectedModels = @'
```json
[
  "openrouter/model-one",
  "openrouter/model-two",
  "openrouter/model-three"
]
```
'@

$new08SelectedModels = @'
```json
[
  "uuid-model-1",
  "uuid-model-2",
  "uuid-model-3"
]
```

Важно: `selected_models` хранит UUID выбранных записей из таблицы `models`, а не OpenRouter `model_key`. Фактический `model_key` сохраняется отдельно в `model_responses` как технический снимок модели на момент ответа.
'@

Replace-RequiredText -Path "08-database.md" -OldText $old08SelectedModels -NewText $new08SelectedModels -Label "08: selected_models хранит UUID"

# H3 - 09-api-structure.md: API принимает modelIds как UUID models.id
Replace-RequiredText -Path "09-api-structure.md" `
    -OldText "modelIds`r`n# список выбранных моделей в API body" `
    -NewText "modelIds`r`n# массив UUID выбранных моделей из таблицы models; это не OpenRouter model_key" `
    -Label "09: описание modelIds"

$compareRequestAnchor = @'
```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "modelIds": ["uuid-model-1", "uuid-model-2"],
  "modeSlug": "prompt-arena"
}
```
'@

$compareRequestNote = @'
Важно: `modelIds` - это значения `models.id`. Backend по этим UUID находит записи в таблице `models`, проверяет доступность моделей и только потом берёт `model_key` для OpenRouter.
'@

Add-TextAfterOnce -Path "09-api-structure.md" -AnchorText $compareRequestAnchor -TextToAdd $compareRequestNote -Label "09: пояснение modelIds в /api/compare"

Replace-RequiredText -Path "09-api-structure.md" `
    -OldText "| `modelIds` | Каждая модель должна существовать в allowlist или таблице `models` |" `
    -NewText "| `modelIds` | Каждый UUID должен существовать в allowlist или таблице `models` |" `
    -Label "09: валидация UUID modelIds"

# H2 и H3 - 11-ai-models.md: лимит 8000 и modelIds как UUID
$old11Limits = @'
```text
max_models_per_request = 3
# максимум 3 модели за один запрос

min_models_per_request = 2
# сравнение должно иметь минимум 2 ответа

max_prompt_chars = 4000
# ограничение длины prompt

max_output_tokens = 800
# ограничение длины ответа модели

request_timeout_seconds = 60
# защита от зависших запросов

save_usage = true
# сохранять usage, если OpenRouter вернул данные
```
'@

$new11Limits = @'
```text
MAX_MODELS_PER_COMPARE = 3
# максимум 3 модели за один запрос

MIN_MODELS_PER_COMPARE = 2
# сравнение должно иметь минимум 2 ответа

MAX_PROMPT_LENGTH = 8000
# канонический лимит длины prompt, должен совпадать с .env.example, 04-mvp-scope.md, 08-database.md и frontend-валидацией

MAX_OUTPUT_TOKENS = 800
# внутренний лимит длины ответа модели для MVP

MODEL_TIMEOUT_MS = 60000
# timeout одного запроса к модели в миллисекундах

save_usage = true
# сохранять usage, если OpenRouter вернул данные
```
'@

Replace-RequiredText -Path "11-ai-models.md" -OldText $old11Limits -NewText $new11Limits -Label "11: лимит prompt 8000"

$old11ModelRule = @'
```text
Frontend показывает display_name.
# пользователь видит понятное название

Frontend отправляет model_key.
# технический ключ из allowlist

Backend проверяет model_key в allowlist.
# настоящая защита находится на сервере

Backend отправляет model_key в OpenRouter.
# OpenRouter API key остаётся только на backend

Backend сохраняет usage и стоимость.
# контроль расходов и статистики
```
'@

$new11ModelRule = @'
```text
Frontend показывает display_name.
# пользователь видит понятное название модели

Frontend отправляет modelIds.
# это UUID записей из allowlist или таблицы models, а не OpenRouter model_key

Backend проверяет modelIds в allowlist или таблице models.
# настоящая защита находится на сервере

Backend получает model_key из проверенной записи модели.
# model_key используется только для вызова OpenRouter

Backend отправляет model_key в OpenRouter.
# OpenRouter API key остаётся только на backend

Backend сохраняет model_id и model_key в model_responses.
# model_id нужен для связи с models, model_key нужен как технический снимок модели на момент ответа

Backend сохраняет usage и стоимость.
# контроль расходов и статистики
```
'@

Replace-RequiredText -Path "11-ai-models.md" -OldText $old11ModelRule -NewText $new11ModelRule -Label "11: правило modelIds вместо model_key"

Replace-RequiredText -Path "11-ai-models.md" `
    -OldText "Если `model_key` не найден в allowlist или модель выключена, запрос нужно отклонить." `
    -NewText "Если `modelId` не найден в allowlist или таблице `models`, либо модель выключена, запрос нужно отклонить." `
    -Label "11: фраза про отклонение modelId"

Replace-RequiredText -Path "11-ai-models.md" `
    -OldText "prompt не длиннее max_prompt_chars.`r`n# контроль стоимости и нагрузки" `
    -NewText "prompt не длиннее MAX_PROMPT_LENGTH.`r`n# контроль стоимости и нагрузки, канонический лимит MVP - 8000 символов" `
    -Label "11: проверка длины prompt"

Replace-RequiredText -Path "11-ai-models.md" `
    -OldText "каждый model_key есть в allowlist.`r`n# защита от подмены" `
    -NewText "каждый modelId есть в allowlist или таблице models.`r`n# защита от подмены`r`n`r`nbackend резолвит modelId в model_key.`r`n# OpenRouter model_key не принимается напрямую от пользователя" `
    -Label "11: проверка modelId в compare"

# Финальная проверка ключевых старых фрагментов
$checks = @(
    @{ Path = "03-tools-and-sites.md"; Bad = "docs/03-tools-and-sites.md" },
    @{ Path = "05-user-roles.md"; Bad = "docs/05-user-roles.md" },
    @{ Path = "07-architecture.md"; Bad = "mkdir components lib types docs" },
    @{ Path = "11-ai-models.md"; Bad = "max_prompt_chars = 4000" },
    @{ Path = "09-api-structure.md"; Bad = "# список выбранных моделей в API body" }
)

foreach ($check in $checks) {
    $content = [System.IO.File]::ReadAllText($check.Path)
    if ($content.Contains($check.Bad)) {
        throw "Проверка не пройдена: найден старый фрагмент '$($check.Bad)' в $($check.Path)"
    }
}

Write-Host "Готово: H1-H3 точечно исправлены. Теперь проверьте git diff и сделайте commit."
