import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'

const initialStateSchema = z.object({
  alias: z.string(),
})

const originalDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  standards: z.array(z.string()),
  filters: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    }),
  ),
})

const researchSchema = z.object({
  generalDefinition: z.string(),
  technicalEssence: z.string(),
  practicalApplication: z.array(z.string()),
  standardsInsights: z.string(),
  differentiation: z.string(),
  seoKeywords: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()),
  }),
})

const judgeEvaluationSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  critique: z.object({
    structureAndVolume: z.string(),
    seoEffectiveness: z.string(),
    generalizationLevel: z.string(),
    htmlQuality: z.string(),
    linguisticQuality: z.string(),
  }),
  requiredCorrections: z.array(z.string()),
})

const storeSchema = z.object({
  originalData: originalDataSchema,
  research: researchSchema,
  generatedDescription: z.string().default(''),
  judgeVerdict: judgeEvaluationSchema.shape.verdict.optional(),
  failedAttempts: z
    .array(
      z.object({
        generatedDescription: z.string(),
        critique: judgeEvaluationSchema.shape.critique,
        requiredCorrections: judgeEvaluationSchema.shape.requiredCorrections,
      }),
    )
    .default([]),
})

const mockStep = createStep({
  id: 'mockStep',
  description: 'Mocks the category description process with a delay',
  inputSchema: initialStateSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData }) => {
    // Wait for 30 seconds as requested
    await new Promise(resolve => setTimeout(resolve, 30000))

    const timestamp = new Date().toISOString()

    return {
      originalData: {
        name: `Mock Category for ${inputData.alias}`,
        description: 'This is a mock original description.',
        standards: ['Mock Standard 1', 'Mock Standard 2'],
        filters: [{ name: 'Mock Filter', values: ['Value 1', 'Value 2'] }],
      },
      research: {
        generalDefinition: 'Mock general definition',
        technicalEssence: 'Mock technical essence',
        practicalApplication: ['App 1', 'App 2'],
        standardsInsights: 'Mock standards insights',
        differentiation: 'Mock differentiation',
        seoKeywords: {
          primary: ['keyword1', 'keyword2'],
          secondary: ['keyword3', 'keyword4'],
        },
      },
      generatedDescription: `[MOCK RESULT] This is a prepared description for category ${inputData.alias}. Generated at ${timestamp}.`,
      judgeVerdict: 'PASS' as 'PASS',
      failedAttempts: [
        {
          generatedDescription: 'This was a failed attempt at a description.',
          critique: {
            structureAndVolume: 'Too short',
            seoEffectiveness: 'Missing primary keywords',
            generalizationLevel: 'Too specific',
            htmlQuality: 'Missing H2 tags',
            linguisticQuality: 'Some typos',
          },
          requiredCorrections: ['Increase word count', 'Add primary keywords', 'Include H2 tags'],
        },
      ],
    }
  },
})

export const testWorkflow = createWorkflow({
  id: 'test-workflow',
  inputSchema: initialStateSchema,
  outputSchema: storeSchema,
})
  .then(mockStep)
  .commit()
