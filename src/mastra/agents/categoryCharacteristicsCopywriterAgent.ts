import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const categoryCharacteristicsCopywriterAgent = createGoogleMultiKeyAgent({
  id: 'category-characteristics-copywriter-agent',
  name: 'Category Characteristics Copywriter Agent',
  description: 'Technical copywriter for structuring and formatting category technical characteristics HTML blocks',
  model: [
    { model: 'google/gemma-4-31b-it', maxRetries: 0 },
    { model: 'google/gemini-3.7-flash', maxRetries: 0 },
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/categoryCharacteristicsCopywriter.md', 'utf-8')
  },
})
