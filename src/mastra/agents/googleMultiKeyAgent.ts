import { Agent } from '@mastra/core/agent'

/**
 * Google Multi-Key Agent Utility (`googleMultiKeyAgent.ts`)
 *
 * Overview:
 * This utility provides automated multi-API-key fallback rotation across Google LLM models.
 *
 * Why this approach:
 * 1. Error Processors Trap Issue: Custom `errorProcessors` returning `{ retry: true }` retry
 *    the *same* active model index repeatedly rather than moving to the next fallback entry in Mastra.
 * 2. Caching Issue: Updating `process.env` dynamically inside an error handler does not update
 *    already instantiated `ModelRouterLanguageModel` instances due to internal caching.
 *
 * How it works:
 * - `buildGoogleMultiKeyModels` takes one or more model definitions and expands them across all available API keys
 *   defined in environment variables (`GOOGLE_API_KEY`, `BACKUP_API_KEY_5`..`10`).
 * - Each expanded model entry receives an explicit `apiKey` parameter and `maxRetries: 0`.
 * - When a quota error or failure occurs on key N, Mastra's native fallback logic smoothly transitions
 *   to the next entry in the model array (which uses key N+1).
 */

type AgentOptions = ConstructorParameters<typeof Agent>[0]
type ModelInput = AgentOptions['model']

function getApiKeys(): string[] {
  return [
    // process.env.GOOGLE_API_KEY,
    // process.env.BACKUP_API_KEY_1,
    // process.env.BACKUP_API_KEY_2,
    // process.env.BACKUP_API_KEY_3,
    // process.env.BACKUP_API_KEY_4,
    // process.env.BACKUP_API_KEY_5,
    // process.env.BACKUP_API_KEY_6,
    // process.env.BACKUP_API_KEY_7,
    // process.env.BACKUP_API_KEY_8,
    // process.env.BACKUP_API_KEY_9,
    // process.env.BACKUP_API_KEY_10,
    // process.env.PAID_API_KEY_1,
    // process.env.PAID_API_KEY_2,
    // process.env.PAID_API_KEY_3,
    // process.env.PAID_API_KEY_4,
    process.env.PAID_API_KEY_5,
    process.env.PAID_API_KEY_6,
    process.env.PAID_API_KEY_7,
    process.env.PAID_API_KEY_8,
  ].filter((key): key is string => !!key)
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function extractModelIdAndConfig(item: any): {
  id: string
  extraConfig?: Record<string, any>
  maxRetries?: number
  [key: string]: any
} {
  if (typeof item === 'string') {
    return { id: item }
  }
  if (item && typeof item === 'object') {
    if (typeof item.model === 'string') {
      const { model, ...rest } = item
      return { id: model, ...rest }
    }
    if (item.model && typeof item.model === 'object' && item.model.id) {
      const { model, ...rest } = item
      const { id, ...modelRest } = model
      return { id, extraConfig: modelRest, ...rest }
    }
    if (typeof item.id === 'string') {
      const { id, ...rest } = item
      return { id, ...rest }
    }
  }
  return { id: String(item) }
}

export function buildGoogleMultiKeyModels(modelOption: ModelInput): ModelInput {
  const apiKeys = getApiKeys()
  if (!apiKeys.length || !modelOption) {
    return modelOption
  }

  if (typeof modelOption === 'function') {
    return modelOption
  }

  const rawList = Array.isArray(modelOption) ? modelOption : [modelOption]
  const expandedList: any[] = []

  for (const item of rawList) {
    const { id, extraConfig = {}, maxRetries, ...rest } = extractModelIdAndConfig(item)
    const randomizedKeys = shuffleArray(apiKeys)

    for (const key of randomizedKeys) {
      expandedList.push({
        ...rest,
        maxRetries: maxRetries ?? 0,
        model: {
          id,
          ...extraConfig,
          apiKey: key,
        },
      })
    }
  }

  return expandedList
}

export function createGoogleMultiKeyAgent(options: AgentOptions) {
  return new Agent({
    ...options,
    model: context => {
      const rotatedModel = buildGoogleMultiKeyModels(options.model)
      if (typeof rotatedModel === 'function') {
        return rotatedModel(context)
      }
      return rotatedModel
    },
  })
}
