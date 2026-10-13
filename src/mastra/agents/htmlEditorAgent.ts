import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { readFileSync } from 'fs'

export const htmlEditorAgent = createGoogleMultiKeyAgent({
  id: 'html-editor-agent',
  name: 'HTML Editor Agent',
  description:
    'Specialized agent for editing HTML content based on user instructions, ensuring clean, valid semantic HTML output without markdown wrappers.',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.7-flash', maxRetries: 0 },
    { model: 'google/gemma-4-31b-it', maxRetries: 0 },
  ],
  instructions: () => {
    return readFileSync('./prompts/htmlEditor.md', 'utf-8')
  },
})
