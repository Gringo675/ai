import { createStep, createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { NodeSSH } from 'node-ssh'
import { fileParserWorkflow } from './fileParser'

const inputSchema = z.object({
  limit: z.number().default(0).describe('Maximum number of files to process (0 = unlimited)'),
})

const fileResultSchema = z.object({
  fileName: z.string(),
  sourceDir: z.string(),
  status: z.enum(['success', 'error']),
  error: z.string().optional(),
})

const outputSchema = z.object({
  totalMissingFiles: z.number(),
  processedFiles: z.number(),
  successfulFiles: z.number(),
  results: z.array(fileResultSchema),
})

const processRemoteFilesStep = createStep({
  id: 'processRemoteFilesStep',
  description: 'Connects via SSH to remote server, identifies unparsed PDF files, parses them locally using fileParserWorkflow, and uploads HTML and MD results back to server.',
  inputSchema,
  outputSchema,
  execute: async ({ inputData, abortSignal }) => {
    const limit = inputData?.limit || 0

    const host = process.env.SSH_HOST
    const username = process.env.SSH_USER
    const password = process.env.SSH_PASSWORD

    if (!host || !username || !password) {
      throw new Error(
        'SSH configuration missing in environment variables. Please set SSH_HOST, SSH_USER, and SSH_PASSWORD in .env',
      )
    }

    const remoteRstrDir = '/home/c/chelin/static/doc/rstr'
    const remoteStndDir = '/home/c/chelin/static/doc/stnd'
    const remoteParsedHtmlDir = '/home/c/chelin/static/doc/parsed/html'
    const remoteParsedMdDir = '/home/c/chelin/static/doc/parsed/md'

    const ssh = new NodeSSH()
    await ssh.connect({
      host,
      username,
      password,
    })

    let tmpDir = ''

    try {
      // Ensure target destination directories exist on remote server
      await ssh.execCommand(`mkdir -p "${remoteParsedHtmlDir}" "${remoteParsedMdDir}"`)

      // Retrieve lists of already parsed HTML and MD files
      const htmlListRes = await ssh.execCommand(`ls -1 "${remoteParsedHtmlDir}"`)
      const parsedHtmlFiles = new Set(
        htmlListRes.stdout
          ? htmlListRes.stdout
              .split('\n')
              .map(f => f.trim())
              .filter(Boolean)
          : [],
      )

      const mdListRes = await ssh.execCommand(`ls -1 "${remoteParsedMdDir}"`)
      const parsedMdFiles = new Set(
        mdListRes.stdout
          ? mdListRes.stdout
              .split('\n')
              .map(f => f.trim())
              .filter(Boolean)
          : [],
      )

      // Find all PDFs in both source directories
      const sourceDirs = [
        { path: remoteRstrDir, name: 'rstr' },
        { path: remoteStndDir, name: 'stnd' },
      ]

      interface RemotePdf {
        fileName: string
        sourceDir: string
        remotePdfPath: string
      }

      const missingPdfs: RemotePdf[] = []

      for (const source of sourceDirs) {
        const dirListRes = await ssh.execCommand(`ls -1 "${source.path}"`)
        const files = dirListRes.stdout
          ? dirListRes.stdout
              .split('\n')
              .map(f => f.trim())
              .filter(Boolean)
          : []

        for (const fileName of files) {
          if (!fileName.toLowerCase().endsWith('.pdf')) {
            continue
          }

          const parsedName = path.parse(fileName).name
          const expectedHtml = `${parsedName}.html`
          const expectedMd = `${parsedName}.md`

          const hasHtml = parsedHtmlFiles.has(expectedHtml)
          const hasMd = parsedMdFiles.has(expectedMd)

          if (!hasHtml || !hasMd) {
            missingPdfs.push({
              fileName,
              sourceDir: source.path,
              remotePdfPath: `${source.path}/${fileName}`,
            })
          }
        }
      }

      const totalMissingFiles = missingPdfs.length
      const pdfsToProcess = limit > 0 ? missingPdfs.slice(0, limit) : missingPdfs

      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'remote-file-parser-'))

      const results: z.infer<typeof fileResultSchema>[] = []
      let successfulFiles = 0

      for (const pdf of pdfsToProcess) {
        if (abortSignal?.aborted) {
          console.log('Workflow run cancelled by user. Stopping remote file processing loop.')
          break
        }

        const parsedPath = path.parse(pdf.fileName)
        const htmlFileName = `${parsedPath.name}.html`
        const mdFileName = `${parsedPath.name}.md`

        const localPdfPath = path.join(tmpDir, pdf.fileName)
        const localHtmlPath = path.join(tmpDir, htmlFileName)
        const localMdPath = path.join(tmpDir, mdFileName)

        try {
          // Download PDF from remote server to local temporary directory
          await ssh.getFile(localPdfPath, pdf.remotePdfPath)

          // Execute single-file parser workflow locally
          const run = await fileParserWorkflow.createRun()
          const runResult = await run.start({
            inputData: { filePath: localPdfPath },
          })

          if (runResult.status !== 'success') {
            const failureErr =
              'error' in runResult && runResult.error
                ? runResult.error
                : new Error(`File parser workflow failed for "${pdf.fileName}" with status: ${runResult.status}`)
            throw failureErr
          }

          // Upload generated HTML and MD files back to remote server
          await ssh.putFile(localHtmlPath, `${remoteParsedHtmlDir}/${htmlFileName}`)
          await ssh.putFile(localMdPath, `${remoteParsedMdDir}/${mdFileName}`)

          successfulFiles++
          results.push({
            fileName: pdf.fileName,
            sourceDir: pdf.sourceDir,
            status: 'success',
          })
        } catch (err: any) {
          const errorMessage = err?.message || String(err)
          console.error(`Error processing remote file ${pdf.fileName}:`, errorMessage)

          results.push({
            fileName: pdf.fileName,
            sourceDir: pdf.sourceDir,
            status: 'error',
            error: errorMessage,
          })

          // Stop entire workflow on error as required
          throw new Error(`Stopped workflow due to failure processing file "${pdf.fileName}": ${errorMessage}`)
        } finally {
          // Clean up temporary local files for this document
          try {
            await fs.unlink(localPdfPath)
          } catch {}
          try {
            await fs.unlink(localHtmlPath)
          } catch {}
          try {
            await fs.unlink(localMdPath)
          } catch {}
        }
      }

      return {
        totalMissingFiles,
        processedFiles: pdfsToProcess.length,
        successfulFiles,
        results,
      }
    } finally {
      if (tmpDir) {
        try {
          await fs.rm(tmpDir, { recursive: true, force: true })
        } catch {}
      }
      ssh.dispose()
    }
  },
})

export const fileParserRemote = createWorkflow({
  id: 'file-parser-remote',
  inputSchema,
  outputSchema,
})
  .then(processRemoteFilesStep)
  .commit()
