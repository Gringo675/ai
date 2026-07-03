import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'

export const saveHtmlToFile = createTool({
  id: 'save-html-to-file',
  description: 'Save a string of HTML content to output/product_description.html',
  inputSchema: z.object({
    htmlContent: z.string().describe('The HTML content to be saved'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    filePath: z.string(),
  }),
  execute: async ({ htmlContent }) => {
    const outputDir = path.join(process.cwd(), 'output')
    const filePath = path.join(outputDir, 'product_description.html')

    try {
      // Ensure the output directory exists
      await fs.mkdir(outputDir, { recursive: true })

      // Write the HTML content to the file
      await fs.writeFile(filePath, htmlContent, 'utf8')

      return {
        success: true,
        filePath: filePath,
      }
    } catch (error) {
      console.error('Error saving HTML to file:', error)
      throw new Error(`Failed to save HTML to file: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
})
