import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const documentCategoryExtractorAgent = createGoogleMultiKeyAgent({
  id: 'document-category-extractor-agent',
  name: 'Document Category Extractor Agent',
  description:
    'Extracts lossless technical specifications and tables from official technical documents for a target product category (no per-SKU filtering within the category).',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/documentCategoryExtractor.md', 'utf-8')
  },
})
