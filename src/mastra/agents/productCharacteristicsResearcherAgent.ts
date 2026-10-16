import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'
import { tavilySearch } from '../tools/tavilySearch'
import { tavilyExtraction } from '../tools/tavilyExtraction'
import { existsSync, readFileSync } from 'fs'

const getPrompt = (file: string) => {
  const p1 = `./src/mastra/public/prompts/${file}`
  const p2 = `./prompts/${file}`
  return readFileSync(existsSync(p1) ? p1 : p2, 'utf-8')
}

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

export const productCharacteristicsResearcherAgent = createGoogleMultiKeyAgent({
  id: 'product-characteristics-researcher-agent',
  name: 'Product Characteristics Researcher Agent',
  description: 'Performs fallback research for single products without official documents',
  model: [
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
    { model: 'google/gemini-3.8-flash', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.1-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash', maxRetries: 0 },
  ],
  defaultOptions: {
    maxSteps: 5,
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: 'high',
        },
      },
    },
  },
  instructions: () => {
    return getPrompt('productCharacteristicsResearcher.md')
  },
  tools: {
    tavilySearch,
    tavilyExtraction,
  },
  inputProcessors: [
    new ResponseCache({
      cache: libsqlCache,
      agentId: 'product-characteristics-researcher-agent',
      scope: null,
      ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
    }),
  ],
})
