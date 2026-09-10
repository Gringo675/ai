import { createGoogleMultiKeyAgent } from './googleMultiKeyAgent'
import { Agent } from '@mastra/core/agent'
import { ResponseCache } from '@mastra/core/processors'
import { LibSQLServerCache } from '../cache/libsqlServerCache'

const libsqlCache = new LibSQLServerCache({
  url: 'file:./src/mastra/public/LibSQLStore/mastra.db',
  tableName: 'mastra_response_cache',
})

export const testAgent = createGoogleMultiKeyAgent({
  id: 'test-agent',
  name: 'Test Agent',
  description: 'A simple test agent',
  // model: ({ requestContext }) => {
  //   console.log(`requestContext: ${JSON.stringify(requestContext, null, 2)}`)

  //   const provider = requestContext.get('provider-id')
  //   console.log(`provider: ${JSON.stringify(provider, null, 2)}`)
  //   const model = requestContext.get('model-id')
  //   console.log(`model: ${JSON.stringify(model, null, 2)}`)
  //   return 'google/gemma-4-31b-it'
  // },
  // model: {
  //   // id: 'google/gemini-3-flash-preview',
  //   id: 'google/gemini-3.1-pro-preview',
  //   apiKey: process.env.GOOGLE_API_KEY,
  // },
  // model: 'google/gemini-3-flash-preview',
  model: 'google/gemma-4-31b-it',
  // model: 'google/gemini-3.5-flash-lite',
  // model: 'google/gemini-3.1-pro-preview',
  // model: [
  //   { model: 'google/gemini-3.1-pro-preview', maxRetries: 0 },
  //   { model: 'google/gemini-2.5-pro', maxRetries: 0 },
  // ],
  // model: {
  //   // id: 'omniroute/oc/big-pickle',
  //   id: 'omniroute/gemini/gemma-4-31b-it', // prefix may be anything
  //   url: 'http://localhost:20128/v1',
  //   apiKey: process.env.OMNIROUTE_API_KEY,
  // },
  instructions: 'Just repeat everything I say',
  inputProcessors: [
    new ResponseCache({
      cache: libsqlCache,
      agentId: 'test-agent',
      scope: null,
      ttl: 60 * 60 * 24 * 7, // 7 days (seconds)
    }),
  ],
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

const argsExample = {
  messages: [
    {
      id: '96696223-ac86-4e1f-96b2-6b5b69b6a49f',
      role: 'signal',
      createdAt: '2026-07-10T06:47:09.627Z',
      threadId: 'a1a03453-0c5c-4535-8200-b37e61e807b5',
      resourceId: 'test-agent',
      type: 'user',
      content: {
        format: 2,
        parts: [
          {
            type: 'text',
            text: 'hkhj',
            createdAt: 1783666029628,
          },
        ],
        metadata: {
          signal: {
            id: '96696223-ac86-4e1f-96b2-6b5b69b6a49f',
            type: 'user',
            tagName: 'user',
            createdAt: '2026-07-10T06:47:09.627Z',
            acceptedAt: '2026-07-10T06:47:09.590Z',
            metadata: {
              clientMessageId: 'client-set-a034530c-5cc5-4542-80b3-7e61e807b552',
            },
          },
        },
      },
    },
  ],
  messageList: {
    messages: [
      {
        id: '96696223-ac86-4e1f-96b2-6b5b69b6a49f',
        role: 'signal',
        createdAt: '2026-07-10T06:47:09.627Z',
        threadId: 'a1a03453-0c5c-4535-8200-b37e61e807b5',
        resourceId: 'test-agent',
        type: 'user',
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'hkhj',
              createdAt: 1783666029628,
            },
          ],
          metadata: {
            signal: {
              id: '96696223-ac86-4e1f-96b2-6b5b69b6a49f',
              type: 'user',
              tagName: 'user',
              createdAt: '2026-07-10T06:47:09.627Z',
              acceptedAt: '2026-07-10T06:47:09.590Z',
              metadata: {
                clientMessageId: 'client-set-a034530c-5cc5-4542-80b3-7e61e807b552',
              },
            },
          },
        },
      },
    ],
    systemMessages: [
      {
        role: 'system',
        content: 'Just repeat everything I say',
      },
    ],
    taggedSystemMessages: {},
    memoryInfo: {
      threadId: 'a1a03453-0c5c-4535-8200-b37e61e807b5',
      resourceId: 'test-agent',
    },
    stateManager: {
      memoryMessages: {},
      newUserMessages: {},
      newResponseMessages: {},
      userContextMessages: {},
      memoryMessagesPersisted: {},
      newUserMessagesPersisted: {},
      newResponseMessagesPersisted: {},
      userContextMessagesPersisted: {},
    },
    _agentNetworkAppend: false,
    filterIncompleteToolCalls: true,
    logger: {},
    isRecording: true,
    recordedEvents: [],
    all: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    remembered: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    rememberedPersisted: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    input: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    inputPersisted: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    response: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    responsePersisted: {
      aiV5: {},
      aiV6: {},
      aiV4: {},
    },
    lastCreatedAt: 1783666029745,
  },
  stepNumber: 0,
  steps: [],
  state: {},
  error: {
    message:
      'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash\nPlease retry in 40.80841398s.',
    name: 'AI_APICallError',
    stack:
      'AI_APICallError: You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash\nPlease retry in 40.80841398s.\n    at file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-P333YRBE.js:6831:14\n    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n    at async postToApi2 (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-P333YRBE.js:6693:28)\n    at async GoogleGenerativeAILanguageModel.doStream (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-P333YRBE.js:20852:50)\n    at async AISDKV6LanguageModel.doStream (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-25T7U65K.js:86:12)\n    at async _ModelRouterLanguageModel.doStream (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-25T7U65K.js:479:29)\n    at async pRetry.default.retries (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-A77V6K33.js:25962:34)\n    at async Module.pRetry (file:///D:/pr_gt/projects/ai/node_modules/p-retry/index.js:197:19)\n    at async createStream (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-A77V6K33.js:25959:16)\n    at async Object.start (file:///D:/pr_gt/projects/ai/node_modules/@mastra/core/dist/chunk-DGWOO2KD.js:104:26)',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:streamGenerateContent?alt=sse',
    requestBodyValues: {
      generationConfig: {},
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'hkhj',
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: 'Just repeat everything I say',
          },
        ],
      },
    },
    statusCode: 429,
    responseHeaders: {
      'alt-svc': 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
      'content-length': '1358',
      'content-type': 'text/event-stream',
      date: 'Fri, 10 Jul 2026 06:47:19 GMT',
      server: 'scaffolding on HTTPServer2',
      'server-timing': 'gfet4t7; dur=178',
      vary: 'Origin, X-Origin, Referer',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'SAMEORIGIN',
      'x-xss-protection': '0',
    },
    responseBody:
      '{\n  "error": {\n    "code": 429,\n    "message": "You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \\n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash\\nPlease retry in 40.80841398s.",\n    "status": "RESOURCE_EXHAUSTED",\n    "details": [\n      {\n        "@type": "type.googleapis.com/google.rpc.Help",\n        "links": [\n          {\n            "description": "Learn more about Gemini API quotas",\n            "url": "https://ai.google.dev/gemini-api/docs/rate-limits"\n          }\n        ]\n      },\n      {\n        "@type": "type.googleapis.com/google.rpc.QuotaFailure",\n        "violations": [\n          {\n            "quotaMetric": "generativelanguage.googleapis.com/generate_content_free_tier_requests",\n            "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",\n            "quotaDimensions": {\n              "location": "global",\n              "model": "gemini-3-flash"\n            },\n            "quotaValue": "20"\n          }\n        ]\n      },\n      {\n        "@type": "type.googleapis.com/google.rpc.RetryInfo",\n        "retryDelay": "40s"\n      }\n    ]\n  }\n}\n',
    isRetryable: true,
    data: {
      error: {
        code: 429,
        message:
          'You exceeded your current quota, please check your plan and billing details. For more information on this error, head to: https://ai.google.dev/gemini-api/docs/rate-limits. To monitor your current usage, head to: https://ai.dev/rate-limit. \n* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests, limit: 20, model: gemini-3-flash\nPlease retry in 40.80841398s.',
        status: 'RESOURCE_EXHAUSTED',
      },
    },
  },
  tracing: {},
  loggerVNext: {},
  metrics: {},
  tracingContext: {},
  requestContext: {
    mastra__isStudio: true,
    mastra__versions: {
      defaultStatus: 'published',
    },
  },
  retryCount: 0,
  writer: {},
  abortSignal: {},
  messageId: '2e90c7cf-3a8c-454a-bd05-7314b3e2d8b8',
}
