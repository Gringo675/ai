import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const categoryCharacteristicsJudgeAgent = createGoogleMultiKeyAgent({
  id: 'category-characteristics-judge-agent',
  name: 'Category Characteristics Judge Agent',
  description: 'Audits generated category technical characteristics against policy and HTML standards',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
    { model: 'google/gemini-3.5-flash-lite', maxRetries: 0 },
    { model: 'google/gemini-3-flash-preview', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/categoryCharacteristicsJudge.md', 'utf-8')
  },
})
