import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { keyHealthTracker } from '../agents/googleAdaptiveAgent'

export const googleKeysHealthTool = createTool({
  id: 'google-keys-health-tool',
  description:
    'Inspect the live status, rate-limit cooldowns, and round-robin metrics of all Google Gemini API keys across models.',
  inputSchema: z.object({
    models: z
      .array(z.string())
      .optional()
      .describe(
        'Optional list of model IDs to inspect (e.g. ["gemini-3.6-flash", "gemini-3.5-flash"]). Defaults to active and standard models.',
      ),
  }),
  outputSchema: z.object({
    timestamp: z.string(),
    totalConfiguredKeys: z.number(),
    deadKeys: z.array(z.string()),
    roundRobinOffsets: z.record(z.string(), z.number()),
    summary: z.object({
      healthyPairs: z.number(),
      cooldownPairs: z.number(),
      revokedPairs: z.number(),
      byModel: z.record(
        z.string(),
        z.object({
          healthyCount: z.number(),
          cooldownCount: z.number(),
          revokedCount: z.number(),
          healthyKeys: z.array(z.string()),
          cooldownKeys: z.array(z.string()),
          revokedKeys: z.array(z.string()),
          cooldownDetails: z.array(
            z.object({
              key: z.string(),
              cooldownRemainingSeconds: z.number(),
            }),
          ),
          currentOffset: z.number(),
        }),
      ),
    }),
    healthStatus: z.array(
      z.object({
        key: z.string(),
        model: z.string(),
        status: z.enum(['HEALTHY', 'COOLDOWN', 'REVOKED']),
        cooldownRemainingSeconds: z.number(),
        failureCount: z.number(),
      }),
    ),
  }),
  execute: async ({ models }) => {
    return keyHealthTracker.getStatus(models)
  },
})
