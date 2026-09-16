import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { Agent } from '@mastra/core/agent'

import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'
import { readFileSync } from 'fs'

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

export const documentCategoryExtractorAgent = createGoogleMultiKeyAgent({
  // export const documentCategoryExtractorAgent = new Agent({
  id: 'document-category-extractor-agent',
  name: 'Document Category Extractor Agent',
  description:
    'Extracts lossless technical specifications and tables from official technical documents for a target product category.',
  // model: {
  //   id: 'omniroute/gemini/gemini-3.7-flash', // prefix may be anything
  //   url: process.env.OMNIROUTE_BASE_URL,
  //   apiKey: process.env.OMNIROUTE_API_KEY,
  // },
  // model: 'omniroute/gemini/gemini-3.5-flash-light',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.7-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/documentCategoryExtractor.md', 'utf-8')
  },
  // inputProcessors: [
  //   new ResponseCache({
  //     cache: libsqlCache,
  //     agentId: 'document-category-extractor-agent',
  //     scope: null,
  //     ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
  //   }),
  // ],
})
