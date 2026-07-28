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

const parsePdfStep = createStep({
  id: 'parsePdfStep',
  description: 'Reads PDF document from filePath and parses it into human HTML and LLM Markdown using fileParserAgent',
  inputSchema,
  outputSchema: parseStepOutputSchema,
  execute: async ({ inputData }) => {
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
              text: 'Parse this PDF document and generate both human-friendly HTML and LLM-optimized hybrid Markdown formats.',
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
        structuredOutput: {
          schema: parseResultSchema,
          jsonPromptInjection: true,
        },
      },
    )

    const parsedObject = response.object as z.infer<typeof parseResultSchema>

    return {
      humanHtml: parsedObject?.humanHtml ?? '',
      llmContext: parsedObject?.llmContext ?? '',
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
