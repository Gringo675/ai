import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import { fileParserWorkflow } from './fileParserWorkflow'

const inputSchema = z.object({
  folderPath: z.string().default('D:\\pr_gt\\norm_docs\\parsing'),
})

const fileResultSchema = z.object({
  fileName: z.string(),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
})

const outputSchema = z.object({
  totalFiles: z.number(),
  successfulFiles: z.number(),
  failedFiles: z.number(),
  results: z.array(fileResultSchema),
})

async function moveFile(srcPath: string, destPath: string) {
  try {
    await fs.access(srcPath)
  } catch {
    return // Source file does not exist
  }

  try {
    await fs.rename(srcPath, destPath)
  } catch {
    // If rename fails (e.g. destination file already exists or EPERM across devices/drives),
    // copy and remove source
    await fs.copyFile(srcPath, destPath)
    await fs.unlink(srcPath)
  }
}

const processFolderStep = createStep({
  id: 'processFolderStep',
  description: 'Scans unparsed folder for PDF files and processes them sequentially using fileParserWorkflow',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const baseFolder = inputData?.folderPath || 'D:\\pr_gt\\norm_docs\\parsing'
    const unparsedFolder = path.join(baseFolder, 'unparsed')
    const parsedFolder = path.join(baseFolder, 'parsed')
    const parsedPdfFolder = path.join(parsedFolder, 'pdf')
    const parsedHtmlFolder = path.join(parsedFolder, 'html')
    const parsedMdFolder = path.join(parsedFolder, 'md')
    const errorsFolder = path.join(baseFolder, 'errors')

    // Ensure target directories exist
    await fs.mkdir(unparsedFolder, { recursive: true })
    await fs.mkdir(parsedFolder, { recursive: true })
    await fs.mkdir(parsedPdfFolder, { recursive: true })
    await fs.mkdir(parsedHtmlFolder, { recursive: true })
    await fs.mkdir(parsedMdFolder, { recursive: true })
    await fs.mkdir(errorsFolder, { recursive: true })

    const entries = await fs.readdir(unparsedFolder, { withFileTypes: true })
    const pdfFiles = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.pdf'))
      .map(entry => entry.name)

    const results: z.infer<typeof fileResultSchema>[] = []
    let successfulFiles = 0
    let failedFiles = 0

    for (const fileName of pdfFiles) {
      if (abortSignal?.aborted) {
        console.log('Workflow run cancelled by user. Stopping file processing loop.')
        break
      }

      const sourcePdfPath = path.join(unparsedFolder, fileName)

      const fileParsedPath = path.parse(sourcePdfPath)
      const htmlFileName = `${fileParsedPath.name}.html`
      const mdFileName = `${fileParsedPath.name}.md`

      const sourceHtmlPath = path.join(unparsedFolder, htmlFileName)
      const sourceMdPath = path.join(unparsedFolder, mdFileName)

      try {
        // Execute single-file parser workflow (saves .html and .md in unparsed folder next to original)
        const run = await fileParserWorkflow.createRun()
        const runResult = await run.start({
          inputData: { filePath: sourcePdfPath },
        })

        if (runResult.status !== 'success') {
          const failureErr =
            'error' in runResult && runResult.error
              ? runResult.error
              : new Error(`Workflow failed with status: ${runResult.status}`)
          throw failureErr
        }

        // Relocate PDF, HTML, and MD files to their corresponding subfolders in parsed
        await moveFile(sourcePdfPath, path.join(parsedPdfFolder, fileName))
        await moveFile(sourceHtmlPath, path.join(parsedHtmlFolder, htmlFileName))
        await moveFile(sourceMdPath, path.join(parsedMdFolder, mdFileName))

        successfulFiles++
        results.push({
          fileName,
          status: 'success',
        })
      } catch (err: any) {
        failedFiles++
        const errorMessage = err?.message || String(err)
        console.error(`Error processing file ${fileName}:`, errorMessage)

        // Relocate PDF file to errors directory
        await moveFile(sourcePdfPath, path.join(errorsFolder, fileName))

        // Clean up leftover HTML/MD files from unparsed if any exist
        try {
          await fs.unlink(sourceHtmlPath)
        } catch {}
        try {
          await fs.unlink(sourceMdPath)
        } catch {}

        results.push({
          fileName,
          status: 'error',
          error: errorMessage,
        })
      }
    }

    return {
      totalFiles: pdfFiles.length,
      successfulFiles,
      failedFiles,
      results,
    }
  },
})

export const fileParserWorkflowAuto = createWorkflow({
  id: 'file-parser-workflow-auto',
  inputSchema,
  outputSchema,
})
  .then(processFolderStep)
  .commit()
