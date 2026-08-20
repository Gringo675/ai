import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { tavilySearch } from '../tools/tavilySearch'
import { readFileSync } from 'fs'

export const categoryCharacteristicsResearcherAgent = createGoogleMultiKeyAgent({
  id: 'category-characteristics-researcher-agent',
  name: 'Category Characteristics Researcher Agent',
  description: 'Performs fallback research and parameter synthesis for categories without official documents',
  model: 'google/gemini-3.6-flash',
  instructions: () => {
    return readFileSync('./prompts/categoryCharacteristicsResearcher.md', 'utf-8')
  },
  tools: {
    tavilySearch,
  },
})
