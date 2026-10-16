import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { existsSync, readFileSync } from 'fs'

const getPrompt = (file: string) => {
  const p1 = `./src/mastra/public/prompts/${file}`
  const p2 = `./prompts/${file}`
  return readFileSync(existsSync(p1) ? p1 : p2, 'utf-8')
}

export const productCharacteristicsCopywriterAgent = createGoogleMultiKeyAgent({
  id: 'product-characteristics-copywriter-agent',
  name: 'Product Characteristics Copywriter Agent',
  description:
    'Technical copywriter for structuring and formatting single product technical characteristics HTML blocks',
  model: [
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
    { model: 'google/gemini-3.8-flash', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.1-flash-lite', maxRetries: 0 },
    // { model: 'google/gemini-3.5-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return [getPrompt('productCharacteristicsCopywriter.md'), getPrompt('productCharacteristicsPolicy.md')].join(
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
