import { Agent } from '@mastra/core/agent'
import { tavilySearch } from '../tools/tavilySearch'
import { readFileSync } from 'fs'

export const categoryResearcherAgent = new Agent({
  id: 'category-researcher-agent',
  name: 'Category Researcher Agent',
  description: 'SEO researcher for measuring tools categories, providing a brief for the copywriter',
  model: 'google/gemini-3.1-flash-lite',
  // model: 'google/gemini-3.5-flash',
  // model: 'google/gemma-4-31b-it',
  instructions: () => {
    return readFileSync('./prompts/categoryResearcher.md', 'utf-8')
  },
  tools: {
    tavilySearch,
  },
})
