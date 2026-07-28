import { createQuotaAgent } from './agentQuotaErrorWrapper'
import { readFileSync } from 'fs'

export const fileParserAgent = createQuotaAgent({
  id: 'file-parser-agent',
  name: 'File Parser Agent',
  description: 'Оцифровывает, распарсивает и структурирует PDF-документы в форматы HTML и Markdown',
  // model: 'google/gemini-3.6-flash',
  // model: 'google/gemma-4-31b-it',
  model: [
    { model: 'google/gemini-3.6-flash', maxRetries: 2 },
    { model: 'google/gemini-3.5-flash', maxRetries: 2 },
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
