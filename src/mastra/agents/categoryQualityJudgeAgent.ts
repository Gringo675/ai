import { Agent } from '@mastra/core/agent'
import { readFileSync } from 'fs'

export const categoryQualityJudgeAgent = new Agent({
  id: 'category-quality-judge-agent',
  name: 'Category Quality Judge Agent',
  description: 'QA specialist for auditing category SEO descriptions',
  // model: 'google/gemini-3.1-flash-lite',
  // model: 'google/gemma-4-31b-it',
  model: [
    { model: 'google/gemini-3.5-flash', maxRetries: 1 },
    { model: 'google/gemini-3-flash-preview', maxRetries: 1 },
    { model: 'google/gemini-2.5-flash', maxRetries: 1 },
    { model: 'google/gemini-3.1-flash-lite', maxRetries: 5 },
  ],
  instructions: () => {
    return readFileSync('./prompts/categoryQualityJudge.md', 'utf-8')
    // return readFileSync('./prompts/categoryQualityToughJudge.md', 'utf-8')
  },
})
