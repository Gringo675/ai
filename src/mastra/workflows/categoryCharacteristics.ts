import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import { documentProductExtractorAgent } from '../agents/documentProductExtractorAgent'
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
  availableProps: z.record(z.string(), z.array(z.string())).default({}),
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

type StoreState = z.infer<typeof storeSchema>

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

    const originalData = {
      alias,
      name: catData.name || alias,
      characteristics: catData.characteristics || '',
      totalProducts: catData.totalProducts || catData.products?.length || 0,
      availableProps: catData.availableProps || {},
      standards: catData.standards || [],
      grsi: catData.grsi || [],
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

    // Sort documents deterministically by year descending (newest to oldest)
    rawDocs.sort((a, b) => b.year - a.year)

    const documentExtractions: z.infer<typeof documentExtractionItemSchema>[] = []

    for (const doc of rawDocs) {
      if (abortSignal?.aborted) {
        console.log('[CategoryCharacteristics] Aborted during document extraction loop.')
        break
      }

      const docReference = `${doc.docNumber} — ${doc.docName}`.trim()

      const prompt = `
Документ: ${docReference}
Целевые продукты для фильтрации:
${JSON.stringify(doc.products, null, 2)}

Текст документа:
${doc.documentText}
`

      try {
        const extractionResult = await documentProductExtractorAgent.generate(prompt, {
          abortSignal,
        })

        const extractedText = (extractionResult.text || '').trim()

        if (extractedText === 'NO_RELEVANT_DATA' || extractedText.includes('NO_RELEVANT_DATA')) {
          console.log(`[CategoryCharacteristics] Document "${docReference}" returned NO_RELEVANT_DATA. Skipping.`)
          continue
        }

        if (!extractedText) {
          console.log(`[CategoryCharacteristics] Document "${docReference}" returned empty extraction. Skipping.`)
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
          extractedMarkdown: extractedText,
        })
      } catch (err: any) {
        console.error(`[CategoryCharacteristics] Error extracting document "${docReference}":`, err?.message || err)
      }
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

    const researchPrompt = `
Категория: ${inputData.originalData.name}
Характеристики: ${inputData.originalData.characteristics}
Стандарты: ${inputData.originalData.standards.join(', ')}
ГРСИ: ${inputData.originalData.grsi.join(', ')}
Доступные свойства (availableProps): ${JSON.stringify(inputData.originalData.availableProps, null, 2)}

Выполните поиск и синтезируйте структурированную техническую сводку характеристик для данной категории измерительного инструмента.
`

    const researchResult = await categoryCharacteristicsResearcherAgent.generate(researchPrompt, {
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
    let prompt = `
Название категории: ${inputData.originalData.name}
Характеристики категории: ${inputData.originalData.characteristics}
Стандарты: ${inputData.originalData.standards.join(', ')}
ГРСИ: ${inputData.originalData.grsi.join(', ')}
---
ПОЛИТИКА ВЕРСТКИ ХАРАКТЕРИСТИК:
${POLICY}
---
`

    if (inputData.usedFallback && inputData.fallbackResearch) {
      prompt += `
[РЕЖИМ FALLBACK-ИССЛЕДОВАНИЯ]
Документы в базе отсутствуют или не содержат релевантных данных.
Используйте следующую исследовательскую сводку для формирования HTML-блока характеристик в соответствии с Политикой:
${inputData.fallbackResearch.technicalSummary}
`
    } else {
      prompt += `
[РЕЖИМ ЭКСТРАКЦИИ ДОКУМЕНТОВ]
Ниже представлены отфильтрованные выжимки из официальных документов (отсортированные от новых к старым):
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
    const prompt = `
Название категории: ${inputData.originalData.name}
---
ПОЛИТИКА ВЕРСТКИ ХАРАКТЕРИСТИК:
${POLICY}
---
СГЕНЕРИРОВАННЫЕ ХАРАКТЕРИСТИКИ (HTML):
${inputData.generatedCharacteristics}
---
Проведите строгий аудит по критериям политики и верните JSON с вердиктом (PASS/FAIL), критикой и исправлениями.
`

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
