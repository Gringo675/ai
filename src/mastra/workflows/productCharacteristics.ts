import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { productCharacteristicsCopywriterAgent } from '../agents/productCharacteristicsCopywriterAgent'
import { productCharacteristicsResearcherAgent } from '../agents/productCharacteristicsResearcherAgent'
import { validateProductCharacteristicsHtml } from '../utils/productCharacteristicsValidator'

const productDocumentSchema = z.object({
  docNumber: z.string(),
  docName: z.string(),
  docType: z.enum(['stnd', 'rstr']),
  fileLink: z.string().nullable().default(null),
  year: z.number().default(2000),
  documentText: z.string().default(''),
})

const productInputSchema = z.object({
  product: z.object({
    id: z.number(),
    name: z.string(),
    alias: z.string(),
    brand: z.string().nullable().default(null),
    characteristics: z.string().default(''),
    props: z.record(z.string(), z.any()).default({}),
  }),
  documents: z.array(productDocumentSchema).default([]),
  categoryCharacteristics: z.string().default(''),
  editorFeedback: z.string().optional(),
})

const fallbackResearchSchema = z.object({
  technicalSummary: z.string(),
})

const storeSchema = z.object({
  product: productInputSchema.shape.product,
  documents: z.array(productDocumentSchema).default([]),
  categoryCharacteristics: z.string().default(''),
  fallbackResearch: fallbackResearchSchema.nullable().optional(),
  usedFallback: z.boolean().default(false),
  generatedCharacteristics: z.string().default(''),
  judgeVerdict: z.enum(['PASS', 'FAIL']).optional(),
  critique: z.any().nullable().optional(),
  requiredCorrections: z.array(z.string()).default([]),
})

const prepareAndResearchStep = createStep({
  id: 'prepareAndResearch',
  description: 'Prepares product data and performs fallback research if official documents are absent',
  inputSchema: productInputSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData, abortSignal }) => {
    const { product, documents, categoryCharacteristics } = inputData

    const validDocs = documents.filter(d => (d.documentText || '').trim().length > 100)

    // Sort documents: standards (stnd) first, then registry (rstr), and by year descending within each
    validDocs.sort((a, b) => {
      if (a.docType === 'stnd' && b.docType !== 'stnd') return -1
      if (a.docType !== 'stnd' && b.docType === 'stnd') return 1
      return (b.year || 0) - (a.year || 0)
    })

    if (validDocs.length > 0) {
      return {
        product,
        documents: validDocs,
        categoryCharacteristics,
        fallbackResearch: null,
        usedFallback: false,
        generatedCharacteristics: '',
        requiredCorrections: [],
      }
    }

    console.log(`[ProductCharacteristics] No valid documents for product "${product.name}". Running research fallback.`)

    const researchPrompt = [
      `Товар: ${product.name}`,
      product.brand ? `Бренд: ${product.brand}` : '',
      `Характеристики каталога: ${JSON.stringify(product.props, null, 2)}`,
      product.characteristics ? `Действующие характеристики: ${product.characteristics}` : '',
      '',
      'Найдите официальные метрологические характеристики, диапазоны, цену деления и пределы допускаемой погрешности для данной модели.',
    ]
      .filter(Boolean)
      .join('\n')

    const researchResult = await productCharacteristicsResearcherAgent.generate(researchPrompt, {
      maxSteps: 5,
      abortSignal,
    })

    const technicalSummary = researchResult.text || 'Технические характеристики отсутствуют.'

    return {
      product,
      documents: [],
      categoryCharacteristics,
      fallbackResearch: { technicalSummary },
      usedFallback: true,
      generatedCharacteristics: '',
      requiredCorrections: [],
    }
  },
})

function formatProductInfo(product: any): string {
  const parts: string[] = [
    '## ДАННЫЕ ЦЕЛЕВОГО ТОВАРА ИЗ КАТАЛОГА',
    `* Наименование: ${product.name}`,
    product.brand ? `* Производитель / Бренд: ${product.brand}` : '',
    `* Свойства каталога: ${JSON.stringify(product.props, null, 2)}`,
    product.characteristics ? `* Действующие характеристики в БД:\n${product.characteristics}` : '',
  ]
  return parts.filter(Boolean).join('\n')
}

function formatSourcesInfo(inputData: {
  documents: any[]
  fallbackResearch?: any
  categoryCharacteristics?: string
  usedFallback: boolean
}): string {
  if (inputData.usedFallback && inputData.fallbackResearch) {
    return [
      '## ИСХОДНЫЕ ДАННЫЕ (РЕЖИМ FALLBACK-ИССЛЕДОВАНИЯ)',
      'Официальные документы к товару в базе отсутствуют.',
      '',
      '### Сводка исследования ресерчера по модели:',
      inputData.fallbackResearch.technicalSummary,
      '',
      '### Справочные характеристики категории (фоновый контекст):',
      inputData.categoryCharacteristics || 'Отсутствуют',
    ].join('\n')
  }

  const docs = inputData.documents || []
  const docsList = docs.map((doc, idx) => {
    return [
      `### Документ ${idx + 1}: ${doc.docNumber} — ${doc.docName}`,
      `* Тип документа: ${doc.docType === 'stnd' ? 'Стандарт (ГОСТ/ТУ)' : 'Госреестр СИ (ГРСИ)'}`,
      `* Ссылка на файл: ${doc.fileLink || 'отсутствует'}`,
      `* Год утверждения: ${doc.year}`,
      `* Текст документа:`,
      doc.documentText,
    ].join('\n')
  })

  return [`## ОФИЦИАЛЬНЫЕ НОРМАТИВНЫЕ ДОКУМЕНТЫ ТОВАРА (ВСЕГО: ${docs.length})`, '', docsList.join('\n\n---\n\n')].join(
    '\n',
  )
}

function buildBasePromptContext(inputData: z.infer<typeof storeSchema>): string {
  const parts: string[] = [formatProductInfo(inputData.product), '---', formatSourcesInfo(inputData)]
  return parts.join('\n\n')
}

const copywriterStep = createStep({
  id: 'copywriter',
  description: 'Generates HTML characteristics block for the specific product',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData, abortSignal }) => {
    console.log(`[ProductCharacteristics][Copywriter] Generating characteristics HTML for: ${inputData.product.name}`)

    const prompt = buildBasePromptContext(inputData)

    const generated = await productCharacteristicsCopywriterAgent.generate(prompt, {
      abortSignal,
    })

    return {
      ...inputData,
      generatedCharacteristics: generated.text || '',
    }
  },
})

const validatorStep = createStep({
  id: 'validator',
  description: 'Deterministically validates generated HTML against syntax standards and document order/links',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData }) => {
    const result = validateProductCharacteristicsHtml(inputData.generatedCharacteristics, inputData.documents)

    console.log(
      `[ProductCharacteristics][Validator] Result: ${result.verdict}${result.reason ? ` - ${result.reason}` : ''}`,
    )

    return {
      ...inputData,
      judgeVerdict: result.verdict,
      critique: null,
      requiredCorrections: result.reason ? [result.reason] : [],
    }
  },
})

export const productCharacteristics = createWorkflow({
  id: 'product-characteristics',
  inputSchema: productInputSchema,
  outputSchema: storeSchema,
  options: {
    onError: (errorInfo: any) => {
      console.error('[ProductCharacteristics] Workflow failed:', errorInfo)
    },
  },
})
  .then(prepareAndResearchStep)
  .then(copywriterStep)
  .then(validatorStep)
  .commit()
