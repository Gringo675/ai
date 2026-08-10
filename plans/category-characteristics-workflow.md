# Specification: Category Characteristics Generation Workflow

## 1. Overview

The goal is to create a new Mastra workflow (`categoryCharacteristics`) that generates the HTML "Characteristics" (`characteristics`) field for product categories based on category alias, source documents (standards / registers), product mappings, available properties, and web search enrichment, using a multi-tier agent pipeline with dedicated document-level extraction for both standards and register documents (`file_ot` description of type and `file_mp` verification procedure).

---

## 2. API & Data Source

- **Endpoint**: `https://chelinstrument.ru/api/ai/categoryData/${alias}`
- **Response Structure**:
  - `catData`: Contains `name`, `alias`, `description`, `characteristics`.
  - `docs`:
    - `stnd`: Array of standard documents (`number`, `name`, `file`, `products`).
    - `rstr`: Array of register documents (`number`, `name`, `type_si`, `brand`, `date`, `file_ot`, `file_mp`, `products`).
  - `categorySummary`: Contains `totalProducts` and `availableProps` (dictionary of filter properties and values).
- **Parsed Document Markdown URLs**:
  - Standards (`stnd`): `https://chelinstrument.ru/static/doc/parsed/${file.replace(/\.pdf$/, '.md')}`
  - Registers Type Description (`rstr` - `file_ot`): `https://chelinstrument.ru/static/doc/parsed/${file_ot.replace(/\.pdf$/, '.md')}`
  - Registers Verification Procedure (`rstr` - `file_mp`): `https://chelinstrument.ru/static/doc/parsed/${file_mp.replace(/\.pdf$/, '.md')}`

---

## 3. Tool Design: [`src/mastra/tools/getCategoryCharacteristicsData.ts`](src/mastra/tools/getCategoryCharacteristicsData.ts:1)

- **Input**: `{ alias: string }`
- **Output**:
  - Category name, alias, description.
  - Processed `stnd` docs array (with fetched markdown text from `file`).
  - Processed `rstr` docs array (with fetched markdown texts from both `file_ot` and `file_mp`).
  - `categorySummary` (`totalProducts`, `availableProps`).
  - Filters.

---

## 4. Agents & Prompts

1. **[`src/mastra/agents/documentExtractorAgent.ts`](src/mastra/agents/documentExtractorAgent.ts:1)**
   - **Role**: Processes a document (standard text, or register type description `file_ot` + verification procedure `file_mp`) along with its associated category products list, extracting only the technical information relevant to those products.
   - **Prompt**: [`src/mastra/public/prompts/documentExtractor.md`](src/mastra/public/prompts/documentExtractor.md:1)

2. **[`src/mastra/agents/categoryCharacteristicsResearcherAgent.ts`](src/mastra/agents/categoryCharacteristicsResearcherAgent.ts:1)**
   - **Role**: Aggregates extracted insights from all document extraction agents, available properties (`categorySummary.availableProps`), and optional web search results (`tavilySearch`) to produce a unified technical brief.
   - **Prompt**: [`src/mastra/public/prompts/categoryCharacteristicsResearcher.md`](src/mastra/public/prompts/categoryCharacteristicsResearcher.md:1)
   - **Tools**: [`src/mastra/tools/tavilySearch.ts`](src/mastra/tools/tavilySearch.ts:1)

3. **[`src/mastra/agents/categoryCharacteristicsCopywriterAgent.ts`](src/mastra/agents/categoryCharacteristicsCopywriterAgent.ts:1)**
   - **Role**: Generates final HTML characteristics formatted as tables or lists, embedding source document links (`/static/doc/stnd/...` and `/static/doc/rstr/...`).
   - **Prompt**: [`src/mastra/public/prompts/categoryCharacteristicsCopywriter.md`](src/mastra/public/prompts/categoryCharacteristicsCopywriter.md:1)
   - **Policy**: [`src/mastra/public/prompts/categoryCharacteristicsPolicy.md`](src/mastra/public/prompts/categoryCharacteristicsPolicy.md:1)

4. **[`src/mastra/agents/categoryCharacteristicsQualityJudgeAgent.ts`](src/mastra/agents/categoryCharacteristicsQualityJudgeAgent.ts:1)**
   - **Role**: Audits generated characteristics for HTML validity, presence of tables/lists, correct document links, and technical accuracy.
   - **Prompt**: [`src/mastra/public/prompts/categoryCharacteristicsJudge.md`](src/mastra/public/prompts/categoryCharacteristicsJudge.md:1)

---

## 5. Workflow Design: [`src/mastra/workflows/categoryCharacteristics.ts`](src/mastra/workflows/categoryCharacteristics.ts:1)

- **Input**: `{ alias: string }`
- **Steps**:
  1. `fetchDataStep`: Calls [`getCategoryCharacteristicsData`](src/mastra/tools/getCategoryCharacteristicsData.ts:1).
  2. `documentExtractionStep`: Runs document extraction for each standard and register document (using both `file_ot` and `file_mp` for registers) with `documentExtractorAgent`.
  3. `researchStep`: Uses `categoryCharacteristicsResearcherAgent` to synthesize extracted document insights and available properties.
  4. `generateAndEvaluateWorkflow` (dountil loop up to 3 attempts):
     - `copywriterStep`: Generates HTML characteristics.
     - `judgeStep`: Evaluates verdict (`PASS`/`FAIL`) with critique and required corrections.
- **Retry Config**: 7 attempts, 5s delay.

---

## 6. Registration: [`src/mastra/index.ts`](src/mastra/index.ts:1)

- Register new tools, agents, and workflow in the main Mastra instance.
