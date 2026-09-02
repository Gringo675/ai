import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { tavilySearch } from '../tools/tavilySearch'
import { readFileSync } from 'fs'

export const categoryCharacteristicsResearcherAgent = createGoogleMultiKeyAgent({
  id: 'category-characteristics-researcher-agent',
  name: 'Category Characteristics Researcher Agent',
  description: 'Performs fallback research and parameter synthesis for categories without official documents',
  model: [
    { model: 'google/gemini-3.5-flash-lite', maxRetries: 1 },
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
    { model: 'google/gemma-4-31b-it', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/categoryCharacteristicsResearcher.md', 'utf-8')
  },
  tools: {
    tavilySearch,
  },
})
