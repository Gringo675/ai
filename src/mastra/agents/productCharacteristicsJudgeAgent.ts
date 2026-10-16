import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { existsSync, readFileSync } from 'fs'

const getPrompt = (file: string) => {
  const p1 = `./src/mastra/public/prompts/${file}`
  const p2 = `./prompts/${file}`
  return readFileSync(existsSync(p1) ? p1 : p2, 'utf-8')
}

export const productCharacteristicsJudgeAgent = createGoogleMultiKeyAgent({
  id: 'product-characteristics-judge-agent',
  name: 'Product Characteristics Judge Agent',
  description: 'Audits generated single product technical characteristics against policy and source documents',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.7-flash', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.1-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return [getPrompt('productCharacteristicsJudge.md'), getPrompt('productCharacteristicsPolicy.md')].join(
      '\n\n---\n\n',
    )
  },
  defaultOptions: {
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingLevel: 'high',
        },
      },
    },
  },
})
