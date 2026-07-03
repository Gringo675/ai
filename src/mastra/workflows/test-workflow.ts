import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { getCategoryData } from '../tools/getCategoryData'

const categoryDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  standards: z.array(z.string()),
  filters: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    }),
  ),
})

const fetchCategoryDataStep = createStep({
  id: 'fetchCategoryData',
  description: 'Fetches category name and description from the API',
  inputSchema: z.object({
    alias: z.string().describe('The category alias'),
  }),
  outputSchema: categoryDataSchema,
  execute: async ({ inputData }) => {
    const result = await (getCategoryData!.execute as any)({ alias: inputData.alias }, {} as any)
    return result as {
      name: string
      description: string
      standards: string[]
      filters: { name: string; values: string[] }[]
    }
  },
})

export const testWorkflow = createWorkflow({
  id: 'w111',
  inputSchema: z.object({
    alias: z.string().describe('The category alias to fetch data for'),
  }),
  outputSchema: z.object({
    finalDescription: z.string(),
  }),
  retryConfig: {
    attempts: 7,
    delay: 2000,
  },
  options: {
    onError: (errorInfo: any) => {
      console.error('Workflow failed after all retries:', errorInfo)
    },
  },
})
  .then(fetchCategoryDataStep)
  .commit()
