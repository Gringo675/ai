import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'
import { tavilySearch } from '../tools/tavilySearch'
import { tavilyExtraction } from '../tools/tavilyExtraction'
import { readFileSync } from 'fs'

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

export const categoryCharacteristicsResearcherAgent = createGoogleMultiKeyAgent({
  id: 'category-characteristics-researcher-agent',
  name: 'Category Characteristics Researcher Agent',
  description: 'Performs fallback research and parameter synthesis for categories without official documents',
  model: [
    { model: 'google/gemini-3.5-flash', maxRetries: 1 },
    { model: 'google/gemini-3.5-flash-lite', maxRetries: 0 },
    { model: 'google/gemma-4-31b-it', maxRetries: 0 },
  ],
  defaultOptions: {
    maxSteps: 7,
  },
  instructions: () => {
    return readFileSync('./prompts/categoryCharacteristicsResearcher.md', 'utf-8')
  },
  tools: {
    tavilySearch,
    tavilyExtraction,
  },
  inputProcessors: [
    new ResponseCache({
      cache: libsqlCache,
      agentId: 'category-characteristics-researcher-agent',
      scope: null,
      ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
    }),
  ],
})
