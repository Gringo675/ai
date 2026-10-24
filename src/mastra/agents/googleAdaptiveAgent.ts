import { Agent } from '@mastra/core/agent'
import { RequestContext } from '@mastra/core/request-context'

/**
 * Google Adaptive Fault-Tolerant Agent Utility (`googleAdaptiveAgent.ts`)
 *
 * Overview:
 * Adaptive multi-API-key fallback rotation system with per-model quota tracking
 * and automatic HTTP error interception.
 *
 * Core Principles:
 * 1. Model-Scoped Quota Tracking: Quotas (429) are tracked per (apiKey, modelId) pair.
 *    If key K5 hits 429 on 'gemini-3.6-flash', K5 enters cooldown ONLY for 'gemini-3.6-flash'.
 *    It remains active for 'gemini-3.5-flash', 'gemini-2.5-pro', and other models.
 * 2. Only Healthy Keys in Rotation: Keys on cooldown for a given model are excluded.
 *    If all keys for Model A are in cooldown, the agent immediately falls back to Model B
 *    without sending doomed HTTP requests.
 * 3. Exact Google Retry-Delay: Cooldown duration is read from Google's response (`retryDelay`)
 *    with a safety buffer (+1s), defaulting to 60s if not specified.
 * 4. Error Code Discrimination:
 *    - 429 (RESOURCE_EXHAUSTED): Put (apiKey, modelId) on cooldown.
 *    - 403 / 401 (PERMISSION_DENIED / UNAUTHENTICATED / Invalid Key): Disable key globally across all models.
 *    - 503 (UNAVAILABLE / Model Overloaded): Log warning; do NOT penalize the key.
 *    - 200 OK: Reset failure counters for (apiKey, modelId).
 * 5. Round-Robin Distribution: Healthy keys rotate cyclically per model to ensure even load.
 */

type AgentOptions = ConstructorParameters<typeof Agent>[0]
type ModelInput = AgentOptions['model']

function getApiKeys(): string[] {
  return [
    process.env.GOOGLE_API_KEY,
    process.env.BACKUP_API_KEY_1,
    process.env.BACKUP_API_KEY_2,
    process.env.BACKUP_API_KEY_3,
    process.env.BACKUP_API_KEY_4,
    process.env.BACKUP_API_KEY_5,
    process.env.BACKUP_API_KEY_6,
    process.env.BACKUP_API_KEY_7,
    process.env.BACKUP_API_KEY_8,
    process.env.BACKUP_API_KEY_9,
    process.env.BACKUP_API_KEY_10,
    // process.env.PAID_API_KEY_1,
    // process.env.PAID_API_KEY_2,
    // process.env.PAID_API_KEY_3,
    // process.env.PAID_API_KEY_4,
    // process.env.PAID_API_KEY_5,
    // process.env.PAID_API_KEY_6,
    // process.env.PAID_API_KEY_7,
    // process.env.PAID_API_KEY_8,
  ].filter((key): key is string => !!key)
}

function normalizeModelId(id: string): string {
  return id.replace(/^(google\/|models\/)/i, '').trim()
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return '***'
  return `...${key.slice(-4)}`
}

interface KeyModelHealthState {
  cooldownUntil: number
  failureCount: number
}

class KeyHealthTracker {
  // Composite key: `${apiKey}::${normalizedModelId}`
  private pairStates = new Map<string, KeyModelHealthState>()
  // Keys dead globally (403 Forbidden / revoked)
  private deadKeys = new Set<string>()
  // Round-robin offset per normalizedModelId
  private roundRobinOffsets = new Map<string, number>()
  // Models configured or actively observed in the system
  private knownModels = new Set<string>()

  private getCompositeKey(apiKey: string, modelId: string): string {
    return `${apiKey}::${normalizeModelId(modelId)}`
  }

  registerModel(rawModelId: string): void {
    if (rawModelId) {
      this.knownModels.add(normalizeModelId(rawModelId))
    }
  }

  isKeyDead(apiKey: string): boolean {
    return this.deadKeys.has(apiKey)
  }

  isPairHealthy(apiKey: string, modelId: string): boolean {
    if (this.deadKeys.has(apiKey)) return false
    const state = this.pairStates.get(this.getCompositeKey(apiKey, modelId))
    if (!state) return true
    return Date.now() >= state.cooldownUntil
  }

  recordSuccess(apiKey: string, modelId: string): void {
    const normalizedModel = normalizeModelId(modelId)
    this.knownModels.add(normalizedModel)
    const compositeKey = this.getCompositeKey(apiKey, normalizedModel)
    const state = this.pairStates.get(compositeKey)
    if (state && state.cooldownUntil <= Date.now()) {
      state.failureCount = 0
      state.cooldownUntil = 0
    }
  }

  recordRateLimit(apiKey: string, modelId: string, retryDelayMs: number = 60_000): void {
    const normalizedModel = normalizeModelId(modelId)
    this.knownModels.add(normalizedModel)
    const compositeKey = this.getCompositeKey(apiKey, normalizedModel)
    const state = this.pairStates.get(compositeKey) ?? { cooldownUntil: 0, failureCount: 0 }

    state.failureCount += 1
    state.cooldownUntil = Date.now() + retryDelayMs
    this.pairStates.set(compositeKey, state)

    console.warn(
      `[GoogleAdaptiveAgent] ⚠️ Quota exceeded (429) for key ${maskKey(apiKey)} on model "${normalizedModel}". ` +
        `Cooldown: ${Math.round(retryDelayMs / 1000)}s`,
    )
  }

  recordRevoked(apiKey: string, statusCode: number = 403, reason?: string): void {
    this.deadKeys.add(apiKey)
    const reasonText = reason ? `: ${reason}` : ''
    console.error(
      `[GoogleAdaptiveAgent] ❌ API key ${maskKey(apiKey)} is invalid/disabled (${statusCode}${reasonText}). Disabled globally across all models.`,
    )
  }

  recordOverloaded(apiKey: string, modelId: string): void {
    const normalizedModel = normalizeModelId(modelId)
    this.knownModels.add(normalizedModel)
    console.warn(
      `[GoogleAdaptiveAgent] ⚠️ Google model "${normalizedModel}" is overloaded (503). ` +
        `Server-side issue, key ${maskKey(apiKey)} remains healthy.`,
    )
  }

  /**
   * Filters keys to only healthy ones for this model, and orders them via Round-Robin.
   */
  getHealthyKeysForModel(apiKeys: string[], rawModelId: string, advance: boolean = true): string[] {
    const normalizedModel = normalizeModelId(rawModelId)
    this.knownModels.add(normalizedModel)
    const healthy = apiKeys.filter(key => this.isPairHealthy(key, normalizedModel))

    if (healthy.length <= 1) {
      return healthy
    }

    // Round-Robin rotation among healthy keys
    const currentOffset = this.roundRobinOffsets.get(normalizedModel) ?? 0
    const offset = currentOffset % healthy.length

    if (advance) {
      this.roundRobinOffsets.set(normalizedModel, (currentOffset + 1) % healthy.length)
    }

    return [...healthy.slice(offset), ...healthy.slice(0, offset)]
  }

  /**
   * Returns earliest cooldown timestamp for a model (used for failsafe).
   */
  getEarliestCooldownUntil(apiKeys: string[], rawModelId: string): number {
    const normalizedModel = normalizeModelId(rawModelId)
    let earliest = Infinity
    for (const key of apiKeys) {
      if (this.deadKeys.has(key)) continue
      const state = this.pairStates.get(this.getCompositeKey(key, normalizedModel))
      const cd = state?.cooldownUntil ?? 0
      if (cd < earliest) earliest = cd
    }
    return earliest
  }

  /**
   * Generates a comprehensive health report for browser / tooling inspection.
   */
  getStatus(modelsToCheck?: string[]) {
    const now = Date.now()
    const apiKeys = getApiKeys()

    // Collect all unique models: passed models + known configured models + recorded models
    const uniqueModels = new Set<string>()
    if (modelsToCheck && modelsToCheck.length > 0) {
      modelsToCheck.forEach(m => uniqueModels.add(normalizeModelId(m)))
    } else {
      // 1. Models registered on agents
      for (const m of this.knownModels) {
        uniqueModels.add(m)
      }
      // 2. Models tracked in round-robin offsets
      for (const m of this.roundRobinOffsets.keys()) {
        uniqueModels.add(m)
      }
      // 3. Models tracked in pairStates
      for (const compositeKey of this.pairStates.keys()) {
        const parts = compositeKey.split('::')
        if (parts[1]) uniqueModels.add(parts[1])
      }

      // Fallback only if no models have been registered or observed yet
      if (uniqueModels.size === 0) {
        ;['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemma-4-31b-it'].forEach(m => uniqueModels.add(m))
      }
    }

    const items: Array<{
      key: string
      model: string
      status: 'HEALTHY' | 'COOLDOWN' | 'REVOKED'
      cooldownRemainingSeconds: number
      failureCount: number
    }> = []

    let healthyCount = 0
    let cooldownCount = 0
    let revokedCount = 0

    const byModel: Record<
      string,
      {
        healthyCount: number
        cooldownCount: number
        revokedCount: number
        healthyKeys: string[]
        cooldownKeys: string[]
        revokedKeys: string[]
        cooldownDetails: Array<{ key: string; cooldownRemainingSeconds: number }>
        currentOffset: number
      }
    > = {}

    for (const model of uniqueModels) {
      byModel[model] = {
        healthyCount: 0,
        cooldownCount: 0,
        revokedCount: 0,
        healthyKeys: [],
        cooldownKeys: [],
        revokedKeys: [],
        cooldownDetails: [],
        currentOffset: this.roundRobinOffsets.get(model) ?? 0,
      }

      for (const key of apiKeys) {
        const masked = maskKey(key)
        const isDead = this.deadKeys.has(key)

        if (isDead) {
          revokedCount++
          byModel[model].revokedCount++
          byModel[model].revokedKeys.push(masked)
          items.push({
            key: masked,
            model,
            status: 'REVOKED',
            cooldownRemainingSeconds: 0,
            failureCount: 999,
          })
          continue
        }

        const compositeKey = this.getCompositeKey(key, model)
        const state = this.pairStates.get(compositeKey)
        const isCooldown = state ? state.cooldownUntil > now : false
        const remainingSec = isCooldown && state ? Math.ceil((state.cooldownUntil - now) / 1000) : 0

        if (isCooldown) {
          cooldownCount++
          byModel[model].cooldownCount++
          byModel[model].cooldownKeys.push(masked)
          byModel[model].cooldownDetails.push({
            key: masked,
            cooldownRemainingSeconds: remainingSec,
          })
          items.push({
            key: masked,
            model,
            status: 'COOLDOWN',
            cooldownRemainingSeconds: remainingSec,
            failureCount: state?.failureCount ?? 0,
          })
        } else {
          healthyCount++
          byModel[model].healthyCount++
          byModel[model].healthyKeys.push(masked)
          items.push({
            key: masked,
            model,
            status: 'HEALTHY',
            cooldownRemainingSeconds: 0,
            failureCount: state?.failureCount ?? 0,
          })
        }
      }
    }

    const offsets: Record<string, number> = {}
    for (const m of uniqueModels) {
      offsets[m] = this.roundRobinOffsets.get(m) ?? 0
    }

    return {
      timestamp: new Date().toISOString(),
      totalConfiguredKeys: apiKeys.length,
      deadKeys: Array.from(this.deadKeys).map(k => maskKey(k)),
      roundRobinOffsets: offsets,
      summary: {
        healthyPairs: healthyCount,
        cooldownPairs: cooldownCount,
        revokedPairs: revokedCount,
        byModel,
      },
      healthStatus: items,
    }
  }
}

export const keyHealthTracker = new KeyHealthTracker()

function extractGoogleApiKey(input: RequestInfo | URL, init?: RequestInit): string | null {
  if (init?.headers) {
    if (init.headers instanceof Headers) {
      const val = init.headers.get('x-goog-api-key')
      if (val) return val
    } else if (Array.isArray(init.headers)) {
      const entry = init.headers.find(([k]) => k.toLowerCase() === 'x-goog-api-key')
      if (entry) return entry[1]
    } else if (typeof init.headers === 'object') {
      for (const [k, v] of Object.entries(init.headers)) {
        if (k.toLowerCase() === 'x-goog-api-key' && typeof v === 'string') return v
      }
    }
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const val = input.headers.get('x-goog-api-key')
    if (val) return val
  }

  try {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as any).url
    if (urlStr) {
      const parsed = new URL(urlStr)
      const param = parsed.searchParams.get('key')
      if (param) return param
    }
  } catch {}

  return null
}

function extractGoogleModelId(url: string): string | null {
  const match = url.match(/\/models\/([^/:]+)/)
  return match ? match[1] : null
}

let isInterceptorInstalled = false

export function setupGoogleFetchInterceptor(): void {
  if (isInterceptorInstalled) return
  isInterceptorInstalled = true

  const originalFetch = globalThis.fetch

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : ((input as any)?.url ?? '')

    // Only intercept requests to Google Generative Language API
    if (!url.includes('generativelanguage.googleapis.com')) {
      return originalFetch(input, init)
    }

    const apiKey = extractGoogleApiKey(input, init)
    const modelId = extractGoogleModelId(url)

    const response = await originalFetch(input, init)

    if (response.ok) {
      if (apiKey && modelId) {
        keyHealthTracker.recordSuccess(apiKey, modelId)
      }
      return response
    }

    if (apiKey) {
      if (response.status === 429) {
        let retryDelayMs = 60_000

        try {
          // Clone the response so we can read body without consuming the stream for Mastra
          const clone = response.clone()
          const text = await clone.text()

          // Check retryDelay in JSON details (e.g., "retryDelay": "40s" or "40.8s")
          const retryMatch = text.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/)
          if (retryMatch) {
            retryDelayMs = Math.ceil(parseFloat(retryMatch[1]) * 1000) + 1000 // +1s safety buffer
          } else {
            // Check Retry-After response header
            const retryAfter = response.headers.get('retry-after')
            if (retryAfter) {
              const seconds = parseFloat(retryAfter)
              if (!isNaN(seconds) && seconds > 0) {
                retryDelayMs = Math.ceil(seconds * 1000) + 1000
              }
            }
          }
        } catch {}

        if (modelId) {
          keyHealthTracker.recordRateLimit(apiKey, modelId, retryDelayMs)
        }
      } else if (response.status === 403 || response.status === 401) {
        let reason: string | undefined
        try {
          const clone = response.clone()
          const text = await clone.text()
          const match = text.match(/"message"\s*:\s*"([^"]+)"/)
          if (match) {
            reason = match[1]
          }
        } catch {}

        keyHealthTracker.recordRevoked(apiKey, response.status, reason)
      } else if (response.status === 503) {
        if (modelId) {
          keyHealthTracker.recordOverloaded(apiKey, modelId)
        }
      }
    }

    return response
  }
}

// Auto-initialize interceptor on module import
setupGoogleFetchInterceptor()

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

export function buildGoogleAdaptiveModels(
  modelOption: ModelInput,
  defaultMaxRetries: number = 0,
  advance: boolean = true,
): ModelInput {
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
    keyHealthTracker.registerModel(id)
    // Only include healthy keys for this model, ordered via Round-Robin
    const healthyKeys = keyHealthTracker.getHealthyKeysForModel(apiKeys, id, advance)

    for (const key of healthyKeys) {
      expandedList.push({
        ...rest,
        maxRetries: maxRetries ?? defaultMaxRetries,
        model: {
          id,
          ...extraConfig,
          apiKey: key,
        },
      })
    }
  }

  // Failsafe: if every key for every model is in cooldown, return all non-dead keys
  // so Mastra does not crash with an empty model array exception
  if (expandedList.length === 0) {
    console.warn(
      `[GoogleAdaptiveAgent] ⚠️ All keys for all configured models are currently on cooldown. ` +
        `Engaging failsafe fallback across non-dead keys.`,
    )
    for (const item of rawList) {
      const { id, extraConfig = {}, maxRetries, ...rest } = extractModelIdAndConfig(item)
      const nonDeadKeys = apiKeys.filter(k => !keyHealthTracker.isKeyDead(k))
      const fallbackKeys = nonDeadKeys.length > 0 ? nonDeadKeys : apiKeys

      for (const key of fallbackKeys) {
        expandedList.push({
          ...rest,
          maxRetries: maxRetries ?? defaultMaxRetries,
          model: {
            id,
            ...extraConfig,
            apiKey: key,
          },
        })
      }
    }
  }

  return expandedList
}

export function createGoogleAdaptiveAgent(options: AgentOptions) {
  const CACHE_KEY = '__adaptive_resolved_model__'
  const EXEC_KEY = '__adaptive_is_execution__'

  // Pre-register models configured for this agent
  if (options.model && typeof options.model !== 'function') {
    const rawList = Array.isArray(options.model) ? options.model : [options.model]
    for (const item of rawList) {
      const { id } = extractModelIdAndConfig(item)
      if (id) keyHealthTracker.registerModel(id)
    }
  }

  const agent = new Agent({
    ...options,
    model: context => {
      const rc = context?.requestContext
      if (rc && rc.get(CACHE_KEY)) {
        return rc.get(CACHE_KEY)
      }

      const isExecution = Boolean(rc && rc.get(EXEC_KEY))
      const adaptiveModel = buildGoogleAdaptiveModels(options.model, options.maxRetries, isExecution)
      const resolved = typeof adaptiveModel === 'function' ? adaptiveModel(context) : adaptiveModel

      if (rc) {
        rc.set(CACHE_KEY, resolved)
      }
      return resolved
    },
  })

  // Ensure generate() and stream() share a single RequestContext across Mastra's internal getLLM() and execute()
  const origGenerate = agent.generate.bind(agent)
  ;(agent as any).generate = (messages: any, opt: any) => {
    const rc = opt?.requestContext ?? new RequestContext()
    rc.set(EXEC_KEY, true)
    return origGenerate(messages, { ...opt, requestContext: rc })
  }

  const origStream = agent.stream.bind(agent)
  ;(agent as any).stream = (messages: any, opt: any) => {
    const rc = opt?.requestContext ?? new RequestContext()
    rc.set(EXEC_KEY, true)
    return origStream(messages, { ...opt, requestContext: rc })
  }

  return agent
}
