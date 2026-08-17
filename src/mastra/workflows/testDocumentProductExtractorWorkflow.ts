import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { documentProductExtractorAgent } from '../agents/documentProductExtractorAgent'

const inputSchema = z.object({
  alias: z.string().describe('Алиас категории'),
})

const outputSchema = z.object({
  documentReference: z.string(),
  targetProductsCount: z.number(),
  extractedMarkdown: z.string(),
  outputPath: z.string(),
})

const textFields = [
  {
    name: 'text',
    label: 'Стандарт',
  },
  {
    name: 'text_ot',
    label: 'Описание типа',
  },
  {
    name: 'text_mp',
    label: 'Методика поверки',
  },
]

const testExtractStep = createStep({
  id: 'test-extract-first-document-step',
  description:
    'Fetches category data from local API, takes the first available document, iterates over text fields to build documentText, runs documentProductExtractorAgent, and saves result to scratch file',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const { alias } = inputData
    const apiUrl = `http://localhost:3000/api/ai/categoryData/${alias}`

    console.log(`[Workflow] Fetching category data from local API: ${apiUrl}`)
    const response = await fetch(apiUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch category data: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    const catData = data.catData
    if (!catData) {
      throw new Error(`Category data not found for alias: ${alias}`)
    }

    const firstDoc = data.docs?.rstr?.[0] ?? data.docs?.stnd?.[0]
    if (!firstDoc) {
      throw new Error(`No documents found for category alias: ${alias}`)
    }

    const docReference = `${firstDoc.number || 'Unknown'} — ${firstDoc.name || ''}`.trim()
    const products = firstDoc.products || []

    const documentText = textFields
      .map(({ name, label }) => {
        const content = firstDoc[name]
        return content ? `## ${label}\n\n${content}` : null
      })
      .filter(Boolean)
      .join('\n\n---\n\n')

    if (!documentText) {
      throw new Error(`First document (${docReference}) has empty text content`)
    }

    console.log(
      `[Workflow] Running documentProductExtractorAgent for doc "${docReference}" with ${products.length} products`,
    )

    const prompt = `
Документ: ${docReference}
Целевые продукты для фильтрации: ${JSON.stringify(products, null, 2)}

Текст документа:
${documentText}
`

    const extractionResult = await documentProductExtractorAgent.generate(prompt, {
      abortSignal,
    })

    const extractedMarkdown = extractionResult.text || ''

    const outputDir = path.resolve(process.cwd(), '.scratch/document-product-extractor')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `test-${alias}.md`)
    await fs.writeFile(outputPath, extractedMarkdown, 'utf-8')
    console.log(`[Workflow] Saved extraction result to: ${outputPath}`)

    return {
      documentReference: docReference,
      targetProductsCount: products.length,
      extractedMarkdown,
      outputPath,
    }
  },
})

export const testDocumentProductExtractorWorkflow = createWorkflow({
  id: 'test-document-product-extractor-workflow',
  inputSchema,
  outputSchema,
})
  .then(testExtractStep)
  .commit()
