# План разработки: Воркфлоу генерации характеристик категории (`categoryCharacteristics`)

## 1. Архитектурный обзор

Создание изолированного конвейера генерации поля `characteristics` (HTML-блок технических характеристик и параметров) для категорий товаров интернет-магазина измерительного инструмента:
- Получение данных категории по API: `http://localhost:3000/api/ai/categoryData/${alias}`.
- Детерминированная сортировка документов по годам (от свежих к старым).
- Пошаговая экстракция параметров и таблиц через `documentProductExtractorAgent` под список `products` категории.
- Автоматическая фильтрация документов без релевантной информации (`NO_RELEVANT_DATA`).
- Fallback-исследование через `categoryCharacteristicsResearcherAgent` (Tavily Search + `availableProps`), если у категории нет документов с текстом.
- Генерация чистого HTML-кода через `categoryCharacteristicsCopywriterAgent` на основе единой политики `categoryCharacteristicsPolicy.md`.
- Аудит качества и проверка ссылок/верстки через `categoryCharacteristicsQualityJudgeAgent` в цикле `dountil` (до 3 попыток).
- Сохранение полного контекста (`storeSchema`) для последующей ручной проверки и ревизии.

---

## 2. Модель состояния воркфлоу (`storeSchema`)

```ts
const originalDataSchema = z.object({
  alias: z.string(),
  name: z.string(),
  description: z.string(),
  characteristics: z.string().default(''), // Исходные характеристики категории (если были)
  totalProducts: z.number(),
  availableProps: z.record(z.string(), z.array(z.string())),
  standards: z.array(z.string()),
  grsi: z.array(z.string()),
})

const documentExtractionItemSchema = z.object({
  docNumber: z.string(), // "ГОСТ 6507-90" или "№ 56549-14"
  docName: z.string(),
  docType: z.enum(['stnd', 'rstr']),
  fileLink: z.string().nullable(), // "/static/doc/stnd/..." или "/static/doc/rstr/..."
  fileType: z.enum(['stnd', 'file_ot', 'file_mp']).nullable(),
  year: z.number(),
  productsCount: z.number(),
  extractedMarkdown: z.string(),
})

const fallbackResearchSchema = z.object({
  technicalSummary: z.string(),
  sources: z.array(z.string()).optional(),
})

const judgeCritiqueSchema = z.object({
  htmlQuality: z.string(),
  linkIntegrity: z.string(),
  technicalPrecision: z.string(),
  structureAndCompleteness: z.string(),
  noMarketingFluff: z.string(),
})

const judgeEvaluationSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  critique: judgeCritiqueSchema,
  requiredCorrections: z.array(z.string()),
})

const storeSchema = z.object({
  originalData: originalDataSchema,
  documentExtractions: z.array(documentExtractionItemSchema).default([]),
  fallbackResearch: fallbackResearchSchema.nullable().optional(),
  usedFallback: z.boolean().default(false),
  generatedCharacteristics: z.string().default(''),
  judgeVerdict: judgeEvaluationSchema.shape.verdict.optional(),
  critique: judgeCritiqueSchema.optional(),
  requiredCorrections: z.array(z.string()).default([]),
  failedAttempts: z
    .array(
      z.object({
        generatedCharacteristics: z.string(),
        critique: judgeCritiqueSchema,
        requiredCorrections: z.array(z.string()),
      }),
    )
    .default([]),
})
```

---

## 3. Список создаваемых и модифицируемых файлов

### 3.1. Политики и промпты (`src/mastra/public/prompts/`)
1. **`documentProductExtractor.md`** *(модификация)*:
   - Добавить строгое правило: если в документе нет параметров/таблиц по целевым продуктам (частый случай методик поверки), возвращать ровно `NO_RELEVANT_DATA`.
2. **`categoryCharacteristicsPolicy.md`** *(новый)*:
   - Политика верстки характеристик:
     - Обязательный заголовок со ссылкой `class="doc-viewer-link" target="_blank"`:
       - Стандарт: `<strong>Параметры по <a class="doc-viewer-link" target="_blank" title="Открыть ГОСТ ..." href="/static/doc/stnd/...">ГОСТ ...</a></strong>`
       - Госреестр: `<strong>Параметры по Госреестру <a class="doc-viewer-link" target="_blank" title="Открыть описание типа" href="/static/doc/rstr/...">№ ...</a></strong>` (если нет `file_ot`, используется `file_mp`).
       - Fallback: заголовок без ссылки, отражающий суть параметров.
     - Обязательное оформление таблиц в HTML `<table>` (никакого Markdown-синтаксиса `|---|`).
     - Сохранение `colspan`/`rowspan`.
     - Соблюдение хронологического порядка (от свежих к старым).
     - Запрет на маркетинговый шум (только сухие технические данные и параметры).
3. **`categoryCharacteristicsCopywriter.md`** *(новый)*:
   - Инструкция копирайтера технических характеристик.
4. **`categoryCharacteristicsJudge.md`** *(новый)*:
   - Инструкция судьи-аудитора характеристик по критериям политики.
5. **`categoryCharacteristicsResearcher.md`** *(новый)*:
   - Инструкция fallback-исследователя при отсутствии документов (синтез `availableProps` + Tavily Search).

### 3.2. Агенты (`src/mastra/agents/`)
1. **`categoryCharacteristicsCopywriterAgent.ts`** (модель `google/gemma-4-31b-it` или `google/gemini-3.6-flash`).
2. **`categoryCharacteristicsJudgeAgent.ts`** (мультимодельный fallback `google/gemini-3.6-flash`, `google/gemini-3.5-flash`, ...).
3. **`categoryCharacteristicsResearcherAgent.ts`** (модель `google/gemini-3.1-flash-lite` с инструментом `tavilySearch`).

### 3.3. Воркфлоу (`src/mastra/workflows/`)
1. **`categoryCharacteristics.ts`** *(новый)*:
   - `fetchAndExtractStep`:
     - Загрузка данных из API `http://localhost:3000/api/ai/categoryData/${alias}`.
     - Извлечение всех `stnd` и `rstr` документов, у которых есть текст.
     - Парсинг годов (например `90` → `1990`, `24` → `2024`) и сортировка по убыванию года.
     - Последовательный прогон `documentProductExtractorAgent`.
     - Фильтрация ответов `NO_RELEVANT_DATA`.
   - `researchFallbackStep` (выполняется только если `documentExtractions.length === 0`):
     - Запуск `categoryCharacteristicsResearcherAgent` с передачей `availableProps` и контекста категории.
   - `generateAndEvaluateWorkflow` (`dountil` цикл до 3 итераций):
     - `copywriterStep`: сборка HTML-блока характеристик.
     - `judgeStep`: проверка на соответствие `categoryCharacteristicsPolicy.md`.

### 3.4. Регистрация в реестре
- Добавление новых агентов и воркфлоу в **`src/mastra/index.ts`**.

---

## 4. Этапы выполнения

1. Обновить промпт `documentProductExtractor.md` (добавить директиву `NO_RELEVANT_DATA`).
2. Создать файлы промптов и политику: `categoryCharacteristicsPolicy.md`, `categoryCharacteristicsCopywriter.md`, `categoryCharacteristicsJudge.md`, `categoryCharacteristicsResearcher.md`.
3. Создать агентов: `categoryCharacteristicsResearcherAgent.ts`, `categoryCharacteristicsCopywriterAgent.ts`, `categoryCharacteristicsJudgeAgent.ts`.
4. Реализовать воркфлоу `categoryCharacteristics.ts`.
5. Зарегистрировать всё в `src/mastra/index.ts`.
6. Провести тестирование на категории с документами (`mikrometry-mk-gladkie`) и на fallback-категории без документов (`tsirkuli-razmetochnye`).
