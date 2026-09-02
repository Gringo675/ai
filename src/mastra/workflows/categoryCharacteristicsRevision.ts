import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { categoryCharacteristicsCopywriterAgent } from '../agents/categoryCharacteristicsCopywriterAgent'
import { categoryCharacteristicsJudgeAgent } from '../agents/categoryCharacteristicsJudgeAgent'
import fs from 'fs/promises'

const POLICY = await fs.readFile('./prompts/categoryCharacteristicsPolicy.md', 'utf-8')

const originalDataSchema = z.object({
  alias: z.string(),
  name: z.string(),
  characteristics: z.string().default(''),
  totalProducts: z.number().default(0),
  availableProps: z.any().default({}),
  standards: z.array(z.string()).default([]),
  grsi: z.array(z.string()).default([]),
})

const documentExtractionItemSchema = z.object({
  docNumber: z.string(),
  docName: z.string(),
  docType: z.enum(['stnd', 'rstr']),
  fileLink: z.string().nullable(),
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

const initialSchema = z.object({
  originalData: originalDataSchema,
  documentExtractions: z.array(documentExtractionItemSchema).default([]),
  fallbackResearch: fallbackResearchSchema.nullable().optional(),
  usedFallback: z.boolean().default(false),
  generatedCharacteristics: z.string(),
  revisionText: z.string(),
})

const outputSchema = z.object({
  finalCharacteristics: z.string(),
  judgeEvaluation: judgeEvaluationSchema,
})

const revisionStep = createStep({
  id: 'revision',
  description: 'Revises the category characteristics based on human editorial remarks',
  inputSchema: initialSchema,
  outputSchema: z.object({
    originalData: originalDataSchema,
    documentExtractions: z.array(documentExtractionItemSchema),
    fallbackResearch: fallbackResearchSchema.nullable().optional(),
    usedFallback: z.boolean(),
    finalCharacteristics: z.string(),
  }),
  execute: async ({ inputData, abortSignal }) => {
    const standardsLine =
      inputData.originalData.standards.length > 0 ? `Стандарты: ${inputData.originalData.standards.join(', ')}` : ''
    const grsiLine = inputData.originalData.grsi.length > 0 ? `ГРСИ: ${inputData.originalData.grsi.join(', ')}` : ''

    let prompt = [
      POLICY,
      '---',
      `Название категории: ${inputData.originalData.name}`,
      inputData.originalData.characteristics
        ? `Действующие характеристики: ${inputData.originalData.characteristics}`
        : '',
      standardsLine,
      grsiLine,
      '---',
    ]
      .filter(Boolean)
      .join('\n')

    if (inputData.usedFallback && inputData.fallbackResearch) {
      prompt += `
[РЕЖИМ FALLBACK-ИССЛЕДОВАНИЯ]
Документы в базе отсутствуют или не содержат релевантных данных.
Используйте следующую исследовательскую сводку:
${inputData.fallbackResearch.technicalSummary}
`
    } else {
      prompt += `
[РЕЖИМ ЭКСТРАКЦИИ ДОКУМЕНТОВ]
Используйте следующие выжимки из официальных документов (отсортированные от новых к старым):
${JSON.stringify(inputData.documentExtractions, null, 2)}
`
    }

    prompt += `
---
Предыдущая версия HTML-характеристик для исправления:
${inputData.generatedCharacteristics}
---
Замечания редактора для исправления:
${inputData.revisionText}
---
Ваша предыдущая попытка требует доработки. Пожалуйста, перепишите HTML-блок характеристик категории, учитывая все вышеперечисленные данные и строго следуя замечаниям редактора, при этом не нарушая общую политику характеристик. Придерживайтесь политики характеристик в целом, однако замечания редактора имеют более высокий приоритет: если они противоречат политике, следуйте замечаниям редактора, а не политике.
`

    const result = await categoryCharacteristicsCopywriterAgent.generate(prompt, {
      abortSignal,
    })

    return {
      originalData: inputData.originalData,
      documentExtractions: inputData.documentExtractions,
      fallbackResearch: inputData.fallbackResearch,
      usedFallback: inputData.usedFallback,
      finalCharacteristics: result.text || '',
    }
  },
})

const judgeStep = createStep({
  id: 'judge',
  description: 'Audits generated HTML characteristics against policy and HTML standards',
  inputSchema: z.object({
    originalData: originalDataSchema,
    documentExtractions: z.array(documentExtractionItemSchema),
    fallbackResearch: fallbackResearchSchema.nullable().optional(),
    usedFallback: z.boolean(),
    finalCharacteristics: z.string(),
  }),
  outputSchema: outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    let sourceDataBlock = ''
    if (inputData.originalData.characteristics) {
      sourceDataBlock += `[ДЕЙСТВУЮЩИЕ ХАРАКТЕРИСТИКИ]\n${inputData.originalData.characteristics}\n\n`
    }
    if (inputData.usedFallback && inputData.fallbackResearch) {
      sourceDataBlock += `[РЕЖИМ FALLBACK-ИССЛЕДОВАНИЯ]
Исследовательская сводка:
${inputData.fallbackResearch.technicalSummary}`
    } else {
      sourceDataBlock += `[ИСТОЧНИКИ (ДОКУМЕНТЫ И ВЫЖИМКИ)]
${JSON.stringify(inputData.documentExtractions, null, 2)}`
    }

    const standardsLine =
      inputData.originalData.standards.length > 0 ? `Стандарты: ${inputData.originalData.standards.join(', ')}` : ''
    const grsiLine = inputData.originalData.grsi.length > 0 ? `ГРСИ: ${inputData.originalData.grsi.join(', ')}` : ''

    const prompt = [
      POLICY,
      '---',
      `Название категории: ${inputData.originalData.name}`,
      standardsLine,
      grsiLine,
      standardsLine || grsiLine ? '---' : '',
      '---',
      'ИСХОДНЫЕ ДАННЫЕ (ДЛЯ ПРОВЕРКИ ТЕХНИЧЕСКОЙ ТОЧНОСТИ И ССЫЛОК):',
      sourceDataBlock,
      '---',
      'СГЕНЕРИРОВАННЫЕ ХАРАКТЕРИСТИКИ (HTML):',
      inputData.finalCharacteristics,
      '---',
      'Проведите строгий аудит по критериям политики (включая техническую точность по исходным данным и валидность ссылок) и верните JSON с вердиктом (PASS/FAIL), критикой и исправлениями.',
    ]
      .filter(Boolean)
      .join('\n')

    const result = await categoryCharacteristicsJudgeAgent.generate(prompt, {
      abortSignal,
      structuredOutput: {
        schema: judgeEvaluationSchema,
        jsonPromptInjection: 'auto',
      },
    })

    const judgment = result.object

    return {
      finalCharacteristics: inputData.finalCharacteristics,
      judgeEvaluation: judgment,
    }
  },
})

export const categoryCharacteristicsRevision = createWorkflow({
  id: 'category-characteristics-revision',
  inputSchema: initialSchema,
  outputSchema: outputSchema,
  retryConfig: {
    attempts: 5,
    delay: 3000,
  },
  options: {
    onError: (errorInfo: any) => {
      console.error('[CategoryCharacteristicsRevision] Workflow failed after retries:', errorInfo)
    },
  },
})
  .then(revisionStep)
  .then(judgeStep)
  .commit()
