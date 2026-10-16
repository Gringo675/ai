---
Status: ready-for-human
---

# Issue 03: Воркфлоу Mastra `productCharacteristics`

## Проблема
Необходимо собрать и зарегистрировать в Mastra рабочий процесс (`productCharacteristics`), реализующий обработку одного товара по переданному payload, линейную генерацию ТТХ копирайтером, детерминированную проверку разметки/структуры кодовым валидатором и fallback-исследование при отсутствии документов.

## Требования к реализации
1. Создать воркфлоу [`src/mastra/workflows/productCharacteristics.ts`](file:///home/v-srv/projects/ai/src/mastra/workflows/productCharacteristics.ts).
2. Описать Zod-схемы состояния (`storeSchema`, `productInputSchema`).
3. Шаги воркфлоу (линейное выполнение в один прогон без циклических повторов):
   - `prepareAndResearchStep`: сортирует документы (ГОСТ $\to$ Госреестр по убыванию года), проверяет наличие текстов; если документы отсутствуют — запускает fallback-исследование через [`productCharacteristicsResearcherAgent`](file:///home/v-srv/projects/ai/src/mastra/agents/productCharacteristicsResearcherAgent.ts).
   - `copywriterStep`: генерирует HTML на основе документов (или сводки fallback-ресерчера) и действующих ТТХ товара без `editorFeedback`.
   - `validatorStep`: выполняет детерминированную валидацию сгенерированного HTML через утилиту [`validateProductCharacteristicsHtml`](file:///home/v-srv/projects/ai/src/mastra/utils/productCharacteristicsValidator.ts) на базе `htmlparser2` (проверка парности/баланса тегов, отсутствие markdown и `caption`, inline-стилей, наличие `thead`/`tbody`, `scope="col"`, классов `ta-start`/`ta-end`/`ta-center`, порядка документов и атрибутов ссылок `doc-viewer-link` с `target="_blank"`).
4. Терминальное состояние:
   - Возвращает `generatedCharacteristics`, `judgeVerdict` (`'PASS'` | `'FAIL'`), `requiredCorrections` (массив с понятным текстовым описанием ошибки для UI) и `critique: null`.
5. Зарегистрировать воркфлоу в [`src/mastra/index.ts`](file:///home/v-srv/projects/ai/src/mastra/index.ts).
6. Не запускать `npm run build` или `npm run dev` согласно правилам проекта.
