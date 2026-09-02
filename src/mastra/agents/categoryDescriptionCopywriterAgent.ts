import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const categoryDescriptionCopywriterAgent = createGoogleMultiKeyAgent({
  id: 'category-description-copywriter-agent',
  name: 'Category Description Copywriter Agent',
  description: 'Professional SEO copywriter for category pages in the measuring tools store',
  // model: 'google/gemini-3.1-flash-lite',
  model: 'google/gemma-4-31b-it',
  instructions: () => {
    return readFileSync('./prompts/categoryDescriptionCopywriter.md', 'utf-8')
  },
})
