import { Mastra } from '@mastra/core'
import { Observability, MastraStorageExporter, SamplingStrategyType } from '@mastra/observability'
import { tavilyExtraction } from './tools/tavilyExtraction'
import { tavilySearch } from './tools/tavilySearch'
import { saveHtmlToFile } from './tools/saveHtmlToFile'
import { getCategoryData } from './tools/getCategoryData'
import { categoryResearcherAgent } from './agents/categoryResearcherAgent'
import { categoryCopywriterAgent } from './agents/categoryCopywriterAgent'
import { categoryQualityJudgeAgent } from './agents/categoryQualityJudgeAgent'

import { categoryWorkflow } from './workflows/category-workflow'
import { testWorkflow } from './workflows/test-workflow'
import { testWorkflow3 } from './workflows/test-workflow3'

export const mastra = new Mastra({
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
    categoryWorkflow,
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
