import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { categoryCopywriterAgent } from '../agents/categoryCopywriterAgent'
import { categoryQualityJudgeAgent } from '../agents/categoryQualityJudgeAgent'
import fs from 'fs/promises'

const POLICY = await fs.readFile('./prompts/categoryDescriptionPolicy.md', 'utf-8')

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

const initialSchema = z.object({
  originalData: originalDataSchema,
  research: researchSchema,
  generatedDescription: z.string(),
  revisionText: z.string(),
})

const outputSchema = z.object({
  finalDescription: z.string(),
  judgeEvaluation: judgeEvaluationSchema,
})

const revisionStep = createStep({
  id: 'revision',
  description: 'Revises the category description based on human editorial remarks',
  inputSchema: initialSchema,
  outputSchema: z.object({
    originalData: originalDataSchema,
    research: researchSchema,
    finalDescription: z.string(),
  }),
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
Предыдущая версия текста для исправления:
${inputData.generatedDescription}
---
Замечания редактора для исправления:
${inputData.revisionText}
---
Ваша предыдущая попытка не прошла аудит качества. Пожалуйста, перепишите текст описания категории, учитывая все вышеперечисленные данные и строго следуя замечаниям редактора, при этом не нарушая общую политику описания.
`
    const result = await categoryCopywriterAgent.generate(prompt)
    return {
      originalData: inputData.originalData,
      research: inputData.research,
      finalDescription: result.text,
    }
  },
})

const judgeStep = createStep({
  id: 'judge',
  description: 'Audits the generated category description for quality and SEO compliance',
  inputSchema: z.object({
    originalData: originalDataSchema,
    research: researchSchema,
    finalDescription: z.string(),
  }),
  outputSchema: outputSchema,
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
Сгенерированное описание: ${inputData.finalDescription}
---
`
    const result = await categoryQualityJudgeAgent.generate(prompt, {
      structuredOutput: {
        schema: judgeEvaluationSchema,
        jsonPromptInjection: 'auto',
      },
    })

    const judgment = result.object

    return {
      finalDescription: inputData.finalDescription,
      judgeEvaluation: judgment,
    }
  },
})

export const categoryRevision = createWorkflow({
  id: 'category-revision',
  inputSchema: initialSchema,
  outputSchema: outputSchema,
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
  .then(revisionStep)
  .then(judgeStep)
  .commit()
