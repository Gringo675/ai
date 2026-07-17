import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const getCategoryData = createTool({
  id: 'get-category-data',
  description: 'Fetch needed category data from the API using the category alias.',
  inputSchema: z.object({
    alias: z.string().describe('The category alias (e.g., "mikrometry-mk-gladkie")'),
  }),
  outputSchema: z.object({
    name: z.string(),
    description: z.string(),
    standards: z.array(z.string()),
    grsi: z.array(z.string()),
    filters: z.array(
      z.object({
        name: z.string(),
        values: z.array(z.string()),
      }),
    ),
  }),
  execute: async ({ alias }) => {
    const url = `https://chelinstrument.ru/api/getData/category/${alias}`

    try {
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()

      if (!data.catData) {
        throw new Error(`Category data not found for alias: ${alias}`)
      }

      const standards = data.catData.docs?.stnd?.map((s: any) => s.number) || []
      const grsi = data.catData.docs?.rstr?.map((s: any) => s.number) || []

      const filters = (data.filter || [])
        .filter((f: any) => f.name !== 'Производитель')
        .map((f: any) => ({
          name: f.name,
          values: f.values.map((v: any) => v.name),
        }))

      return {
        name: data.catData.name || '',
        description: data.catData.description || '',
        standards,
        grsi,
        filters,
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch category data: ${error.message}`)
      }
      throw new Error('An unknown error occurred while fetching category data')
    }
  },
})
