import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import { documentCategoryExtractorAgent } from '../agents/documentCategoryExtractorAgent'
import { categoryCharacteristicsResearcherAgent } from '../agents/categoryCharacteristicsResearcherAgent'
import { categoryCharacteristicsCopywriterAgent } from '../agents/categoryCharacteristicsCopywriterAgent'
import { categoryCharacteristicsJudgeAgent } from '../agents/categoryCharacteristicsJudgeAgent'

const POLICY = await fs.readFile('./prompts/categoryCharacteristicsPolicy.md', 'utf-8')

const initialStateSchema = z.object({
  alias: z.string(),
})

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
  toolType: z.string().nullable().default(null),
  brand: z.string().nullable().default(null),
  extractedMarkdown: z.string(),
})

const extractorResultSchema = z.object({
  toolType: z
    .string()
    .nullable()
    .describe('Тип инструмента/прибора в именительном падеже (например: "Уровни брусковые", "Штангенциркули цифровые ШЦЦ")'),
  brand: z
    .string()
    .nullable()
    .describe('Канонический бренд / производитель инструмента (например: "ЧИЗ", "КировИнструмент"). Для стандартов (stnd) — null'),
  extractedMarkdown: z
    .string()
    .nullable()
    .describe('Выжимка таблиц и параметров без потерь или null, если нет релевантных данных'),
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

const fetchAndExtractStep = createStep({
  id: 'fetchAndExtract',
  description:
    'Fetches category data, collects documents, sorts by year descending, and extracts relevant specifications',
  inputSchema: initialStateSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData, abortSignal }) => {
    const { alias } = inputData
    const apiUrl = `http://localhost:3000/api/ai/categoryData/${alias}`

    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch category data for alias "${alias}": ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const catData = data.catData
    if (!catData) {
      throw new Error(`Category data not found for alias: ${alias}`)
    }

    const categorySummary = data.categorySummary || {}
    const docs = data.docs || {}

    const originalData = {
      alias,
      name: catData.name || alias,
      characteristics: catData.characteristics || '',
      totalProducts: categorySummary.totalProducts || 0,
      availableProps: categorySummary.availableProps || {},
      standards: docs.stnd?.map((s: any) => s.number) || [],
      grsi: docs.rstr?.map((s: any) => s.number) || [],
    }

    const rawDocs: Array<{
      docNumber: string
      docName: string
      docType: 'stnd' | 'rstr'
      fileLink: string | null
      fileType: 'stnd' | 'file_ot' | 'file_mp' | null
      year: number
      products: any[]
      documentText: string
    }> = []

    const stndList = data.docs?.stnd || []
    for (const doc of stndList) {
      const docNumber = doc.number || '0'
      const docName = doc.name || ''
      const text = doc.text || ''
      if (!text.trim()) continue

      const year = doc.year || 2000
      const fileLink = doc.url || null
      rawDocs.push({
        docNumber,
        docName,
        docType: 'stnd',
        fileLink,
        fileType: 'stnd',
        year,
        products: doc.products || [],
        documentText: `## Стандарт ${docNumber} — ${docName}\n\n${text}`,
      })
    }

    const rstrList = data.docs?.rstr || []
    for (const doc of rstrList) {
      const docNumber = doc.number || '00'
      const docName = doc.name || ''
      const textOt = doc.text_ot || ''
      const textMp = doc.text_mp || ''
      const combinedText = [
        textOt ? `## Описание типа\n\n${textOt}` : '',
        textMp ? `## Методика поверки\n\n${textMp}` : '',
      ]
        .filter(Boolean)
        .join('\n\n---\n\n')

      if (!combinedText.trim()) continue

      const year = doc.year || 2000
      const fileLink = doc.url_ot || doc.url_mp || null
      const fileType = doc.url_ot ? 'file_ot' : doc.url_mp ? 'file_mp' : null

      rawDocs.push({
        docNumber,
        docName,
        docType: 'rstr',
        fileLink,
        fileType,
        year,
        products: doc.products || [],
        documentText: combinedText,
      })
    }

    // Sort documents: standards (stnd) first, then registries (rstr), and by year descending within each
    rawDocs.sort((a, b) => {
      if (a.docType === 'stnd' && b.docType !== 'stnd') return -1
      if (a.docType !== 'stnd' && b.docType === 'stnd') return 1
      return b.year - a.year
    })

    const documentExtractions: z.infer<typeof documentExtractionItemSchema>[] = []

    for (const doc of rawDocs) {
      if (abortSignal?.aborted) {
        console.log('[CategoryCharacteristics] Aborted during document extraction loop.')
        break
      }

      const docReference = `${doc.docNumber} — ${doc.docName}`.trim()

      if (doc.documentText.length < 200) {
        console.log(
          `[CategoryCharacteristics] Document "${docReference}" has documentText length < 200 (${doc.documentText.length}). Skipping.`,
        )
        continue
      }

      const prompt = `
Документ: ${docReference}
Название категории: ${originalData.name}
Товары категории:
${JSON.stringify(doc.products, null, 2)}

Текст документа:
${doc.documentText}
`

      const extractionResult = await documentCategoryExtractorAgent.generate(prompt, {
        abortSignal,
        structuredOutput: {
          schema: extractorResultSchema,
          jsonPromptInjection: 'auto',
        },
      })

      const resultObj = extractionResult.object as z.infer<typeof extractorResultSchema> | undefined
      const extractedText = (resultObj?.extractedMarkdown || '').trim()

      if (
        !extractedText ||
        extractedText === 'NO_RELEVANT_DATA' ||
        extractedText.includes('NO_RELEVANT_DATA')
      ) {
        console.log(`[CategoryCharacteristics] Document "${docReference}" returned no relevant data. Skipping.`)
        continue
      }

      documentExtractions.push({
        docNumber: doc.docNumber,
        docName: doc.docName,
        docType: doc.docType,
        fileLink: doc.fileLink,
        fileType: doc.fileType,
        year: doc.year,
        productsCount: doc.products.length,
        toolType: resultObj?.toolType || null,
        brand: resultObj?.brand || null,
        extractedMarkdown: extractedText,
      })
    }

    return {
      originalData,
      documentExtractions,
      fallbackResearch: null,
      usedFallback: false,
      generatedCharacteristics: '',
      requiredCorrections: [],
      failedAttempts: [],
    }
  },
})

const researchFallbackStep = createStep({
  id: 'researchFallback',
  description:
    'Performs fallback technical research using Tavily and available props when no documents have relevant data',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData, abortSignal }) => {
    if (inputData.documentExtractions.length > 0) {
      return inputData
    }

    console.log(
      `[CategoryCharacteristics] No relevant documents found. Triggering fallback research for category: ${inputData.originalData.name}`,
    )

    const standardsLine =
      inputData.originalData.standards.length > 0 ? `Стандарты: ${inputData.originalData.standards.join(', ')}` : ''
    const grsiLine = inputData.originalData.grsi.length > 0 ? `ГРСИ: ${inputData.originalData.grsi.join(', ')}` : ''

    const researchPrompt = [
      `Категория: ${inputData.originalData.name}`,
      inputData.originalData.characteristics
        ? `Действующие характеристики: ${inputData.originalData.characteristics}`
        : '',
      standardsLine,
      grsiLine,
      `Доступные модификации: ${JSON.stringify(inputData.originalData.availableProps, null, 2)}`,
      '',
      'Выполните поиск и синтезируйте структурированную техническую сводку характеристик для данной категории измерительного инструмента.',
    ]
      .filter(Boolean)
      .join('\n')

    const researchResult = await categoryCharacteristicsResearcherAgent.generate(researchPrompt, {
      maxSteps: 7,
      abortSignal,
    })

    const technicalSummary = researchResult.text || 'Технические характеристики отсутствуют.'

    return {
      ...inputData,
      usedFallback: true,
      fallbackResearch: {
        technicalSummary,
      },
    }
  },
})

const copywriterStep = createStep({
  id: 'copywriter',
  description: 'Generates HTML characteristics block based on extractions or fallback research according to policy',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
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

    if (inputData.judgeVerdict === 'FAIL' && inputData.failedAttempts.length) {
      const lastFailed = inputData.failedAttempts[inputData.failedAttempts.length - 1]
      prompt += `\n[ПРЕДЫДУЩАЯ ПОПЫТКА ОТКЛОНЕНА СУДЬЕЙ]\n`
      prompt += `Критика:\n${JSON.stringify(lastFailed.critique, null, 2)}\n`
      prompt += `Требуемые исправления:\n${lastFailed.requiredCorrections.join('\n')}\n`
      prompt += `Предыдущий вариант текста:\n${lastFailed.generatedCharacteristics}\n`
    }

    const generated = await categoryCharacteristicsCopywriterAgent.generate(prompt, {
      abortSignal,
    })

    return {
      ...inputData,
      generatedCharacteristics: generated.text || '',
    }
  },
})

const judgeStep = createStep({
  id: 'judge',
  description: 'Audits generated HTML characteristics against policy and HTML standards',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
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
      inputData.generatedCharacteristics,
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
      ...inputData,
      judgeVerdict: judgment.verdict,
      critique: judgment.critique,
      requiredCorrections: judgment.requiredCorrections,
      failedAttempts:
        judgment.verdict === 'PASS'
          ? inputData.failedAttempts
          : [
              ...inputData.failedAttempts,
              {
                generatedCharacteristics: inputData.generatedCharacteristics,
                critique: judgment.critique,
                requiredCorrections: judgment.requiredCorrections,
              },
            ],
    }
  },
})

const generateAndEvaluateWorkflow = createWorkflow({
  id: 'generate-and-evaluate-characteristics',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
})
  .then(copywriterStep)
  .then(judgeStep)
  .commit()

export const categoryCharacteristics = createWorkflow({
  id: 'category-characteristics',
  inputSchema: initialStateSchema,
  outputSchema: storeSchema,
  retryConfig: {
    attempts: 5,
    delay: 3000,
  },
  options: {
    onError: (errorInfo: any) => {
      console.error('[CategoryCharacteristics] Workflow failed after retries:', errorInfo)
    },
  },
})
  .then(fetchAndExtractStep)
  .then(researchFallbackStep)
  .dountil(generateAndEvaluateWorkflow, async ({ inputData, iterationCount }) => {
    if (iterationCount >= 3) return true
    return inputData.judgeVerdict === 'PASS'
  })
  .commit()
