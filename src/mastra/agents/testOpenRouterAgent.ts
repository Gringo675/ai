import { Agent } from '@mastra/core/agent'

export const testOpenRouterAgent = new Agent({
  id: 'openrouter-agent',
  name: 'OpenRouter Agent',
  instructions: 'Just repeat everything I say',
  model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
})
