import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const tavilyExtraction = createTool({
  id: 'tavily-extraction',
  description: 'Fetch clean, LLM-friendly content from a product URL using the Tavily API',
  inputSchema: z.object({
    url: z.string().url().describe('The product URL to extract content from'),
  }),
  outputSchema: z.object({
    content: z.string().describe('The extracted page content'),
  }),
  execute: async ({ url }) => {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not defined in the environment variables')
    }

    const response = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        urls: [url],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Tavily Extraction API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    // Tavily extract returns an array of results for the requested URLs
    const result = data.results?.[0]
    if (!result || !result.raw_content) {
      throw new Error('No content extracted from the provided URL')
    }

    return {
      content: result.raw_content,
    }
  },
})
