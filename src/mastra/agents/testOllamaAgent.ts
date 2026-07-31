import { Agent } from '@mastra/core/agent'

export const testOllamaAgent = new Agent({
  id: 'ollama-agent',
  name: 'Ollama Agent',
  instructions: 'Just repeat everything I say',
  model: 'ollama-cloud/gemma4:31b',
})
