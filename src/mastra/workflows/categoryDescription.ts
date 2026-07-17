import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import { getCategoryData } from '../tools/getCategoryData'
import { categoryResearcherAgent } from '../agents/categoryResearcherAgent'
import { categoryCopywriterAgent } from '../agents/categoryCopywriterAgent'
import { categoryQualityJudgeAgent } from '../agents/categoryQualityJudgeAgent'

const POLICY = await fs.readFile('./prompts/categoryDescriptionPolicy.md', 'utf-8')
// const POLICY = await fs.readFile('./src/mastra/public/prompts/categoryDescriptionPolicy.md', 'utf-8')

const initialStateSchema = z.object({
  alias: z.string(),
})

const originalDataSchema = z.object({
  name: z.string(),
  description: z.string(),
  standards: z.array(z.string()),
  grsi: z.array(z.string()),
  filters: z.array(
    z.object({
      name: z.string(),
      values: z.array(z.string()),
    }),
  ),
})
type originalData = z.infer<typeof originalDataSchema>

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
type research = z.infer<typeof researchSchema>

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

const fetchOriginalDataStep = createStep({
  id: 'fetchOriginalData',
  description: 'Fetches original category data from the API',
  inputSchema: initialStateSchema,
  outputSchema: originalDataSchema,
  execute: async ({ inputData }) => {
    const originalData = await (getCategoryData!.execute as any)({ alias: inputData.alias }, {} as any)
    return originalData as originalData
  },
})

const researchStep = createStep({
  id: 'researcher',
  description: 'Performs market research to enrich category data',
  inputSchema: originalDataSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData }) => {
    const prompt = `
Category Name: ${inputData.name}
Original Category Description: ${inputData.description}
${inputData.standards?.length ? `Standards (GOST/etc): ${inputData.standards.join(', ')}` : ''}
${inputData.filters?.length ? `Available Filters/Options: ${JSON.stringify(inputData.filters)}` : ''}
`
    const research = await categoryResearcherAgent.generate(prompt, {
      structuredOutput: {
        schema: researchSchema,
        jsonPromptInjection: true,
      },
    })

    return {
      originalData: inputData,
      research: research.object as research,
      generatedDescription: '', // Added to satisfy storeSchema
      failedAttempts: [], // Added to satisfy storeSchema
    }
  },
})

const copywriterStep = createStep({
  id: 'copywriter',
  description: 'Generates a final SEO-optimized category description',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData }) => {
    let prompt = `
Название категории: ${inputData.originalData.name}
---
Исходное описание: ${inputData.originalData.description}
---
Технические параметры:
${inputData.originalData.standards?.length ? `- Стандарты: ${inputData.originalData.standards.join(', ')}` : '- Стандарты: не указаны'}
${inputData.originalData.grsi?.length ? `- ГРСИ: ${inputData.originalData.grsi.join(', ')}` : '- ГРСИ: не указаны'}
${inputData.originalData.filters?.length ? `- Фильтры: ${JSON.stringify(inputData.originalData.filters)}` : '- Фильтры: не указаны'}
---
SEO-исследование: ${JSON.stringify(inputData.research, null, 2)}
---
ПОЛИТИКА ОПИСАНИЯ КАТЕГОРИЙ:
${POLICY}
---
`
    if (inputData.judgeVerdict === 'FAIL' && inputData.failedAttempts.length) {
      const lastFailedAttempt = inputData.failedAttempts[inputData.failedAttempts.length - 1]
      prompt += `\nВаша предыдущая попытка не прошла аудит качества. Пожалуйста, перепишите текст, основываясь на следующих замечаниях:\n`

      if (lastFailedAttempt.critique) {
        const critiqueText = Object.entries(lastFailedAttempt.critique)
          .map(([key, value]) => `- **${key}**: ${value}`)
          .join('\n')
        prompt += `\nОбщая критика:\n${critiqueText}\n`
      }

      prompt += `\nТребуемые исправления:\n${lastFailedAttempt.requiredCorrections.join('\n')}\n`
      prompt += `\nПредыдущая версия текста для исправления:\n${lastFailedAttempt.generatedDescription}\n`
    }

    const generatedDescription = await categoryCopywriterAgent.generate(prompt)
    return {
      ...inputData,
      generatedDescription: generatedDescription.text,
    }
  },
})

const judgeStep = createStep({
  id: 'judge',
  description: 'Audits the generated category description for quality and SEO compliance',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
  execute: async ({ inputData }) => {
    const prompt = `
Название категории: ${inputData.originalData.name}
---
Исходное описание: ${inputData.originalData.description}
---
Технические параметры:
${inputData.originalData.standards?.length ? `- Стандарты: ${inputData.originalData.standards.join(', ')}` : '- Стандарты: не указаны'}
${inputData.originalData.grsi?.length ? `- ГРСИ: ${inputData.originalData.grsi.join(', ')}` : '- ГРСИ: не указаны'}
${inputData.originalData.filters?.length ? `- Фильтры: ${JSON.stringify(inputData.originalData.filters)}` : '- Фильтры: не указаны'}
---
SEO-исследование: ${JSON.stringify(inputData.research, null, 2)}
---
ПОЛИТИКА ОПИСАНИЯ КАТЕГОРИЙ:
${POLICY}
---
Сгенерированное описание: ${inputData.generatedDescription}
---
`
    const result = await categoryQualityJudgeAgent.generate(prompt, {
      structuredOutput: {
        schema: judgeEvaluationSchema,
      },
    })

    const judgment = result.object

    return {
      ...inputData,
      judgeVerdict: judgment.verdict,
      failedAttempts:
        judgment.verdict === 'PASS'
          ? inputData.failedAttempts
          : [
              ...inputData.failedAttempts,
              {
                generatedDescription: inputData.generatedDescription,
                critique: judgment.critique,
                requiredCorrections: judgment.requiredCorrections,
              },
            ],
    }
  },
})

const generateAndEvaluateWorkflow = createWorkflow({
  id: 'generate-and-evaluate',
  inputSchema: storeSchema,
  outputSchema: storeSchema,
})
  .then(copywriterStep)
  .then(judgeStep)
  .commit()

export const categoryDescription = createWorkflow({
  id: 'category-description',
  inputSchema: initialStateSchema,
  outputSchema: storeSchema,
  retryConfig: {
    attempts: 7,
    delay: 5000,
  },
  options: {
    onError: (errorInfo: any) => {
      console.error('Workflow failed after all retries:', errorInfo)
    },
  },
})
  .then(fetchOriginalDataStep)
  .then(researchStep)
  .dountil(generateAndEvaluateWorkflow, async ({ inputData, iterationCount }) => {
    if (iterationCount >= 3) return true
    return inputData.judgeVerdict === 'PASS'
  })
  .commit()
