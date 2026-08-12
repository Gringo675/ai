import { Mastra } from '@mastra/core'
import { Observability, MastraStorageExporter, SamplingStrategyType } from '@mastra/observability'
import { LibSQLStore } from '@mastra/libsql'

import { tavilyExtraction } from './tools/tavilyExtraction'
import { tavilySearch } from './tools/tavilySearch'
import { saveHtmlToFile } from './tools/saveHtmlToFile'
import { getCategoryData } from './tools/getCategoryData'

import { categoryResearcherAgent } from './agents/categoryResearcherAgent'
import { categoryCopywriterAgent } from './agents/categoryCopywriterAgent'
import { categoryQualityJudgeAgent } from './agents/categoryQualityJudgeAgent'
import { testAgent } from './agents/testAgent'
import { fileParserAgent } from './agents/fileParserAgent'
import { testOllamaAgent } from './agents/testOllamaAgent'
import { testOpenRouterAgent } from './agents/testOpenRouterAgent'
import { documentProductExtractorAgent } from './agents/documentProductExtractorAgent'

import { categoryDescription } from './workflows/categoryDescription'
import { categoryRevision } from './workflows/categoryRevision'
import { fileParserWorkflow } from './workflows/fileParserWorkflow'
import { fileParserWorkflowAuto } from './workflows/fileParserWorkflowAuto'
import { testWorkflow } from './workflows/test-workflow'
import { testWorkflow3 } from './workflows/test-workflow3'

export const mastra = new Mastra({
  server: {
    port: 4110, // Defaults to PORT env var or 4111
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./LibSQLStore/mastra.db', // in /public folder
  }),
  agents: {
    categoryResearcherAgent,
    categoryCopywriterAgent,
    categoryQualityJudgeAgent,
    testAgent,
    fileParserAgent,
    testOllamaAgent,
    testOpenRouterAgent,
    documentProductExtractorAgent,
  },
  tools: {
    tavilyExtraction,
    tavilySearch,
    saveHtmlToFile,
    getCategoryData,
  },
  workflows: {
    categoryDescription,
    categoryRevision,
    fileParserWorkflow,
    fileParserWorkflowAuto,
    testWorkflow,
    testWorkflow3,
  },
  observability: new Observability({
    configs: {
      default: {
        serviceName: 'category-categories',
        sampling: {
          type: SamplingStrategyType.ALWAYS,
        },
        exporters: [new MastraStorageExporter()],
      },
    },
  }),
})
