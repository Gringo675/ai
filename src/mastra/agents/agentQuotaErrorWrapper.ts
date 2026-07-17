import { Agent } from '@mastra/core/agent'
import { ErrorProcessor } from '@mastra/core/processors'

type AgentOptions = ConstructorParameters<typeof Agent>[0]

const API_KEYS = [
  process.env.GOOGLE_API_KEY,
  process.env.BACKUP_API_KEY_1,
  process.env.BACKUP_API_KEY_2,
  process.env.BACKUP_API_KEY_3,
  process.env.BACKUP_API_KEY_4,
  // process.env.BACKUP_API_KEY_5,
].filter((key): key is string => !!key)

// Mastra's hardcoded value, can't change (i.e. we can change up to 4 times per agent call)
const hardcodedMaxRetries = 4
// Ensure we don't exceed available keys
const maxRetries = Math.min(hardcodedMaxRetries, API_KEYS.length - 1)

const changeGoogleApiKey = async (newKey: string | undefined) => {
  process.env.GOOGLE_API_KEY = newKey
  // Security: Mask the API key in logs
  const maskedKey = newKey ? `***${newKey.slice(-4)}` : 'undefined'
  console.log(`GOOGLE_API_KEY rotated to: ${maskedKey}`)
  // Optional: Wait for a second to ensure the environment variable is set
  await new Promise(resolve => setTimeout(resolve, 1000))
}

export const quotaErrorProcessor: ErrorProcessor = {
  id: 'quota-error-processor',
  processAPIError: async ({ error, retryCount }) => {
    const statusCode = (error as any)?.statusCode
    const isQuotaError = statusCode === 429

    if (!isQuotaError || retryCount >= maxRetries) {
      return { retry: false }
    }

    console.log(`Quota error (429) detected. Rotating keys...`)

    const currentKey = process.env.GOOGLE_API_KEY
    const currentIndex = currentKey ? API_KEYS.indexOf(currentKey) : -1
    const nextIndex = (currentIndex + 1) % API_KEYS.length

    await changeGoogleApiKey(API_KEYS[nextIndex])

    return { retry: true }
  },
}

export function createQuotaAgent(options: AgentOptions) {
  const existingProcessors = Array.isArray(options.errorProcessors) ? options.errorProcessors : []

  return new Agent({
    ...options,
    errorProcessors: [...existingProcessors, quotaErrorProcessor],
  })
}
