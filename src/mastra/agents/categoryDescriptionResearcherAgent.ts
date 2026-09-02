import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { tavilySearch } from '../tools/tavilySearch'
import { readFileSync } from 'fs'

export const categoryDescriptionResearcherAgent = createGoogleMultiKeyAgent({
  id: 'category-description-researcher-agent',
  name: 'Category Description Researcher Agent',
  description: 'SEO researcher for measuring tools categories, providing a brief for the copywriter',
  model: 'google/gemini-3.5-flash-lite',
  // model: 'google/gemini-3.1-flash',
  // model: 'google/gemma-4-31b-it',
  instructions: () => {
    return readFileSync('./prompts/categoryDescriptionResearcher.md', 'utf-8')
  },
  tools: {
    tavilySearch,
  },
})
