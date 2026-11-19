import { createGoogleAdaptiveAgent } from './googleAdaptiveAgent'
import { Agent } from '@mastra/core/agent'
import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

// export const testAgent = createGoogleAdaptiveAgent({
export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A simple test agent',
  // model: async ({ requestContext }) => {
  //   // console.log(`requestContext: ${JSON.stringify(requestContext, null, 2)}`)

  //   // const provider = requestContext.get('provider-id')
  //   // console.log(`provider: ${JSON.stringify(provider, null, 2)}`)
  //   // const model = requestContext.get('model-id')
  //   // console.log(`model: ${JSON.stringify(model, null, 2)}`)

  //   const aaa = await fetch('http://localhost:20128/v1/models', {
  //     headers: {
  //       Authorization: `Bearer ${process.env.OMNIROUTE_API_KEY}`,
  //     },
  //   })
  //   console.log(`status:`, aaa.status)
  //   console.log(`ok:`, aaa.ok)

  //   const text = await aaa.text()
  //   console.log(`body:`, text)

  //   return 'omniroute/oc/big-pickle'
  // },
  // model: {
  //   // id: 'google/gemini-3-flash-preview',
  //   id: 'google/gemini-3.1-pro-preview',
  //   apiKey: process.env.GOOGLE_API_KEY,
  // },
  // model: 'google/gemini-3-flash-preview',
  // model: 'google/gemma-4-31b-it',
  model: {
    id: 'google/gemini-3.6-flash',
    // id: 'google/gemini-3.8-flash',
    // id: 'google/gemini-4-hydrogen',
    apiKey: process.env.PAID_API_KEY_1,
  },
  maxRetries: 0,
  // model: 'google/gemini-3.1-pro-preview',
  // model: [
  //   { model: 'google/gemini-3.1-pro-preview', maxRetries: 0 },
  //   { model: 'google/gemini-2.5-pro', maxRetries: 0 },
  // ],
  // model: {
  //   id: 'omniroute/gweb/gemini-3.8-flash', // prefix may be anything
  //   url: process.env.OMNIROUTE_BASE_URL,
  //   apiKey: process.env.OMNIROUTE_API_KEY,
  // },
  instructions: 'Just repeat everything I say',
  // inputProcessors: [
  //   new ResponseCache({
  //     cache: libsqlCache,
  //     agentId: 'test-agent',
  //     scope: null,
  //     ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
  //   }),
  // ],
})

// export const testAgent = new Agent({
//   id: 'test-agent',
//   name: 'Test Agent',
//   description: 'A simple test agent',
//   // model: 'google/gemini-3-flash-preview',
//   model: {
//     id: 'google/gemini-3-flash-preview',
//     // id: 'google/gemma-4-31b-it',
//     // id: 'google/gemini-3.1-pro-preview',
//     apiKey: '',
//   },
//   // model: 'google/gemma-4-31b-it',
//   instructions: 'Just repeat everything I say',
// })
