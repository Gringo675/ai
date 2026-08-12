import { createMultiKeyAgent } from './multiKeyAgent'
import { readFileSync } from 'fs'

export const documentProductExtractorAgent = createMultiKeyAgent({
  id: 'document-product-extractor-agent',
  name: 'Document Product Extractor Agent',
  description:
    'Extracts and filters precise technical specifications and tables from official technical documents for specific target products.',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/documentProductExtractor.md', 'utf-8')
  },
})
