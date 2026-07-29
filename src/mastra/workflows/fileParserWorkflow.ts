import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { fileParserAgent } from '../agents/fileParserAgent'

const inputSchema = z.object({
  filePath: z.string(),
})

const parseResultSchema = z.object({
  humanHtml: z.string().describe('Clean HTML5 content formatted for human visual reading and printing'),
  llmContext: z
    .string()
    .describe('Token-optimized hybrid Markdown + HTML tables content formatted for LLMs and RAG systems'),
})

const parseStepOutputSchema = z.object({
  humanHtml: z.string(),
  llmContext: z.string(),
  filePath: z.string(),
})

const finalOutputSchema = z.object({
  humanHtml: z.string(),
  llmContext: z.string(),
  htmlOutputPath: z.string(),
  mdOutputPath: z.string(),
})

function extractJsonObject<T>(text: string | undefined | null): T | null {
  if (!text || typeof text !== 'string') return null
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed) as T
  } catch {
    // Strip markdown code fences ```json ... ``` or ``` ... ```
    const cleaned = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim()

    try {
      return JSON.parse(cleaned) as T
    } catch {
      // Find JSON object pattern in text
      const firstBrace = cleaned.indexOf('{')
      const lastBrace = cleaned.lastIndexOf('}')
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        const jsonSubstring = cleaned.substring(firstBrace, lastBrace + 1)
        try {
          return JSON.parse(jsonSubstring) as T
        } catch {
          return null
        }
      }
      return null
    }
  }
}

const parsePdfStep = createStep({
  id: 'parsePdfStep',
  description: 'Reads PDF document from filePath and parses it into human HTML and LLM Markdown using fileParserAgent',
  inputSchema,
  outputSchema: parseStepOutputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const { filePath } = inputData

    // Ensure file exists
    try {
      await fs.access(filePath)
    } catch {
      throw new Error(`File not found at path: ${filePath}`)
    }

    const fileBuffer = await fs.readFile(filePath)

    const response = await fileParserAgent.generate(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Обработай данный документ.',
            },
            {
              type: 'file',
              mimeType: 'application/pdf',
              data: fileBuffer,
            },
          ],
        },
      ],
      {
        abortSignal,
        structuredOutput: {
          schema: parseResultSchema,
          jsonPromptInjection: 'auto',
        },
        providerOptions: {
          google: {
            safetySettings: [
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' },
            ],
          },
        },
      },
    )

    let parsedObject = response.object as z.infer<typeof parseResultSchema> | undefined

    if (!parsedObject?.humanHtml || !parsedObject?.llmContext) {
      const fallback = extractJsonObject<z.infer<typeof parseResultSchema>>(response.text)
      if (fallback?.humanHtml && fallback?.llmContext) {
        parsedObject = fallback
      }
    }

    if (!parsedObject?.humanHtml || !parsedObject?.llmContext) {
      const errorMsg = response.text
        ? `Failed to parse PDF document "${filePath}". The LLM response could not be parsed into expected JSON schema. Response text preview: "${response.text.slice(0, 300)}..."`
        : `Failed to parse PDF document "${filePath}". The LLM returned an empty response. This usually occurs when Gemini safety/recitation filters block the PDF content or the document stream is unreadable.`

      throw new Error(errorMsg)
    }

    return {
      humanHtml: parsedObject.humanHtml,
      llmContext: parsedObject.llmContext,
      filePath,
    }
  },
})

const saveParsedFilesStep = createStep({
  id: 'saveParsedFilesStep',
  description: 'Saves parsed human HTML and LLM Markdown contents to disk alongside original PDF',
  inputSchema: parseStepOutputSchema,
  outputSchema: finalOutputSchema,
  execute: async ({ inputData }) => {
    const { humanHtml, llmContext, filePath } = inputData

    const parsedPath = path.parse(filePath)

    const htmlOutputPath = path.format({
      ...parsedPath,
      base: undefined,
      ext: '.html',
    })

    const mdOutputPath = path.format({
      ...parsedPath,
      base: undefined,
      ext: '.md',
    })

    await fs.writeFile(htmlOutputPath, humanHtml, 'utf-8')
    await fs.writeFile(mdOutputPath, llmContext, 'utf-8')

    return {
      humanHtml,
      llmContext,
      htmlOutputPath,
      mdOutputPath,
    }
  },
})

export const fileParserWorkflow = createWorkflow({
  id: 'file-parser-workflow',
  inputSchema,
  outputSchema: finalOutputSchema,
})
  .then(parsePdfStep)
  .then(saveParsedFilesStep)
  .commit()
