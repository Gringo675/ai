import { Agent } from '@mastra/core/agent'
import { readFileSync } from 'fs'

export const categoryCopywriterAgent = new Agent({
  id: 'category-copywriter-agent',
  name: 'Category Copywriter Agent',
  description: 'Professional SEO copywriter for category pages in the measuring tools store',
  // model: 'google/gemini-3.1-flash-lite',
  model: 'google/gemma-4-31b-it',
  instructions: () => {
    return readFileSync('./prompts/categoryCopywriter.md', 'utf-8')
  },
})
