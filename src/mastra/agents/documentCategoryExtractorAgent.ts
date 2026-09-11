import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'
import { readFileSync } from 'fs'

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

export const documentCategoryExtractorAgent = createGoogleMultiKeyAgent({
  id: 'document-category-extractor-agent',
  name: 'Document Category Extractor Agent',
  description:
    'Extracts lossless technical specifications and tables from official technical documents for a target product category (no per-SKU filtering within the category).',
  model: [
    { model: 'google/gemini-3.7-flash', maxRetries: 0 },
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
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
