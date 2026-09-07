import { Mastra } from '@mastra/core'
import { Observability, MastraStorageExporter, SamplingStrategyType } from '@mastra/observability'
import { LibSQLStore } from '@mastra/libsql'

import { tavilyExtraction } from './tools/tavilyExtraction'
import { tavilySearch } from './tools/tavilySearch'
import { saveHtmlToFile } from './tools/saveHtmlToFile'
import { getCategoryData } from './tools/getCategoryData'

import { categoryDescriptionResearcherAgent } from './agents/categoryDescriptionResearcherAgent'
import { categoryDescriptionCopywriterAgent } from './agents/categoryDescriptionCopywriterAgent'
import { categoryDescriptionJudgeAgent } from './agents/categoryDescriptionJudgeAgent'
import { categoryCharacteristicsResearcherAgent } from './agents/categoryCharacteristicsResearcherAgent'
import { categoryCharacteristicsCopywriterAgent } from './agents/categoryCharacteristicsCopywriterAgent'
import { categoryCharacteristicsJudgeAgent } from './agents/categoryCharacteristicsJudgeAgent'
import { testAgent } from './agents/testAgent'
import { fileParserAgent } from './agents/fileParserAgent'
import { testOllamaAgent } from './agents/testOllamaAgent'
import { testOpenRouterAgent } from './agents/testOpenRouterAgent'
import { documentProductExtractorAgent } from './agents/documentProductExtractorAgent'
import { documentCategoryExtractorAgent } from './agents/documentCategoryExtractorAgent'

import { categoryDescription } from './workflows/categoryDescription'
import { categoryDescriptionRevision } from './workflows/categoryDescriptionRevision'
import { categoryCharacteristics } from './workflows/categoryCharacteristics'
import { categoryCharacteristicsRevision } from './workflows/categoryCharacteristicsRevision'
import { fileParserWorkflow } from './workflows/fileParser'
import { fileParserWorkflowAuto } from './workflows/fileParserAuto'
import { testWorkflow } from './workflows/test-workflow'
import { testWorkflow3 } from './workflows/test-workflow3'
import { testDocumentProductExtractorWorkflow } from './workflows/testDocumentProductExtractorWorkflow'
import { testCategoryCharacteristicsWorkflow } from './workflows/testCategoryCharacteristicsWorkflow'

export const mastra = new Mastra({
  server: {
    port: 4110, // Defaults to PORT env var or 4111
  },
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./LibSQLStore/mastra.db', // in /public folder
  }),
  agents: {
    categoryDescriptionResearcherAgent,
    categoryDescriptionCopywriterAgent,
    categoryDescriptionJudgeAgent,
    categoryCharacteristicsResearcherAgent,
    categoryCharacteristicsCopywriterAgent,
    categoryCharacteristicsJudgeAgent,
    testAgent,
    fileParserAgent,
    testOllamaAgent,
    testOpenRouterAgent,
    documentProductExtractorAgent,
    documentCategoryExtractorAgent,
  },
  tools: {
    tavilyExtraction,
    tavilySearch,
    saveHtmlToFile,
    getCategoryData,
  },
  workflows: {
    categoryDescription,
    categoryDescriptionRevision,
    categoryCharacteristics,
    categoryCharacteristicsRevision,
    fileParserWorkflow,
    fileParserWorkflowAuto,
    testWorkflow,
    testWorkflow3,
    testDocumentProductExtractorWorkflow,
    testCategoryCharacteristicsWorkflow,
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
