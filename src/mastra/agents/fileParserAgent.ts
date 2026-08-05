import { createMultiKeyAgent } from './multiKeyAgent'
import { Agent } from '@mastra/core/agent'
import { readFileSync } from 'fs'

export const fileParserAgent = createMultiKeyAgent({
  id: 'file-parser-agent',
  name: 'File Parser Agent',
  description: 'Оцифровывает, распарсивает и структурирует PDF-документы в форматы HTML и Markdown',
  // model: 'google/gemini-3.6-flash',
  // model: 'google/gemma-4-31b-it',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 0 },
    { model: 'google/gemini-3.5-flash', maxRetries: 0 },
    // { model: 'google/gemini-3-flash-preview', maxRetries: 2 },
    // { model: 'google/gemini-2.5-flash', maxRetries: 2 },
    // { model: 'google/gemini-3.1-flash-lite', maxRetries: 5 },
  ],
  // model: { OpenAI-compatible can't handle pdf files
  //   id: 'omniroute/gemini/gemini-3.6-flash', // prefix may be anything
  //   url: 'http://localhost:20128/v1',
  //   apiKey: process.env.OMNIROUTE_API_KEY,
  // },
  instructions: () => {
    // return readFileSync('./prompts/fileParserLLMOnly.md', 'utf-8')
    return readFileSync('./prompts/fileParser.md', 'utf-8')
  },
})

// Recitation Error File Parser Agent
// export const fileParserAgent = new Agent({
//   id: 'file-parser-agent',
//   name: 'File Parser Agent',
//   description: 'Оцифровывает, распарсивает и структурирует PDF-документы в форматы HTML и Markdown',
//   // model: 'ollama-cloud/minimax-m3', // invalid message format
//   // model: 'ollama-cloud/gemma4:31b', // invalid message format
//   // model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', // very average result, worse than ling
//   // model: 'openrouter/google/gemma-4-31b-it:free', // google returns 429
//   model: 'openrouter/inclusionai/ling-3.0-flash:free', // works, but has little issues
//   instructions: () => {
//     // return readFileSync('./prompts/fileParserLLMOnly.md', 'utf-8')
//     return readFileSync('./prompts/fileParser.md', 'utf-8')
//   },
// })
