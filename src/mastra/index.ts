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

import { categoryDescription } from './workflows/categoryDescription'
import { testWorkflow } from './workflows/test-workflow'
import { testWorkflow3 } from './workflows/test-workflow3'

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'mastra-storage',
    url: 'file:./LibSQLStore/mastra.db', // in /public folder
  }),
  agents: {
    categoryResearcherAgent,
    categoryCopywriterAgent,
    categoryQualityJudgeAgent,
  },
  tools: {
    tavilyExtraction,
    tavilySearch,
    saveHtmlToFile,
    getCategoryData,
  },
  workflows: {
    categoryDescription,
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
