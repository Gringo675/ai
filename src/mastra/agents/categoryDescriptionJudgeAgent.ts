import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const categoryDescriptionJudgeAgent = createGoogleMultiKeyAgent({
  id: 'category-description-judge-agent',
  name: 'Category Description Judge Agent',
  description: 'QA specialist for auditing category SEO descriptions',
  // model: 'google/gemini-3.1-flash-lite',
  // model: 'google/gemma-4-31b-it',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 2 },
    { model: 'google/gemini-3.5-flash', maxRetries: 2 },
    { model: 'google/gemini-3-flash-preview', maxRetries: 2 },
    { model: 'google/gemini-2.5-flash', maxRetries: 2 },
    // { model: 'google/gemini-3.1-flash-lite', maxRetries: 5 },
  ],
  instructions: () => {
    return readFileSync('./prompts/categoryDescriptionJudge.md', 'utf-8')
  },
})
