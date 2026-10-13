import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { htmlEditorAgent } from '../agents/htmlEditorAgent'

export const inputSchema = z.object({
  text: z.string().describe('The current HTML/text content to be modified'),
  instruction: z.string().describe('The user edit instructions (e.g. format as table, make more concise, fix typos)'),
})

export const outputSchema = z.object({
  modifiedText: z.string().describe('The updated, clean, valid HTML content with changes applied'),
})

function cleanHtmlOutput(raw: string): string {
  let cleaned = (raw || '').trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
  }
  return cleaned
}

const htmlEditStep = createStep({
  id: 'html-edit-step',
  description: 'Modifies HTML content based on user instructions using htmlEditorAgent',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const prompt = [
      'Исходный HTML-контент для редактирования:',
      inputData.text,
      '---',
      'Инструкция по редактированию:',
      inputData.instruction,
      '---',
      'Примените указанную инструкцию к исходному контенту. Верните исключительно результирующий чистый HTML без markdown-разметки (без ```html) и без каких-либо комментариев.',
    ].join('\n')

    const response = await htmlEditorAgent.generate(prompt, {
      abortSignal,
    })

    const rawText = response.text || ''
    const modifiedText = cleanHtmlOutput(rawText)

    return {
      modifiedText,
    }
  },
})

export const htmlContentEdit = createWorkflow({
  id: 'html-content-edit',
  inputSchema,
  outputSchema,
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .then(htmlEditStep)
  .commit()
