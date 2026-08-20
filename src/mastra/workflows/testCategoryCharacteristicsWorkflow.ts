import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { categoryCharacteristics } from './categoryCharacteristics'

const inputSchema = z.object({
  alias: z.string(),
})

const outputSchema = z.object({
  alias: z.string(),
  usedFallback: z.boolean(),
  documentExtractionsCount: z.number(),
  generatedCharacteristicsLength: z.number(),
  outputPath: z.string(),
})

const testStep = createStep({
  id: 'test-category-characteristics-step',
  description: 'Runs categoryCharacteristics workflow for given alias and saves result',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const { alias } = inputData
    console.log(`[TestWorkflow] Starting categoryCharacteristics for alias: ${alias}`)

    const run = await categoryCharacteristics.createRun()
    const runResult = await run.start({
      inputData: { alias },
    })

    if (runResult.status !== 'success') {
      throw new Error(`Workflow failed with status: ${runResult.status}`)
    }

    const output = runResult.result as any

    const outputDir = path.resolve(process.cwd(), '.scratch/category-characteristics')
    await fs.mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `test-result-${alias}.json`)
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8')

    const htmlOutputPath = path.join(outputDir, `test-characteristics-${alias}.html`)
    await fs.writeFile(htmlOutputPath, output.generatedCharacteristics || '', 'utf-8')

    console.log(`[TestWorkflow] Saved result for ${alias} to: ${outputPath}`)

    return {
      alias,
      usedFallback: output.usedFallback,
      documentExtractionsCount: output.documentExtractions?.length || 0,
      generatedCharacteristicsLength: output.generatedCharacteristics?.length || 0,
      outputPath,
    }
  },
})

export const testCategoryCharacteristicsWorkflow = createWorkflow({
  id: 'test-category-characteristics-workflow',
  inputSchema,
  outputSchema,
})
  .then(testStep)
  .commit()
