import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const tavilySearch = createTool({
  id: 'tavily-search',
  description: 'Tool for performing web searches',
  inputSchema: z.object({
    query: z.string().describe('The research query'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string(),
      }),
    ),
  }),
  execute: async ({ query }) => {
    const apiKey = process.env.TAVILY_API_KEY
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY is not defined in the environment variables')
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query: query,
        search_depth: 'advanced',
        max_results: 5,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Tavily Search API error: ${response.status} ${errorText}`)
    }

    const data = await response.json()

    return {
      results: data.results || [],
    }
  },
})
