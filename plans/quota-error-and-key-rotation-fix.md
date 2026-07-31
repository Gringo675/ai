# Plan: Fix Mastra Model Fallback Array and Dynamic API Key Rotation

## Overview

This plan addresses two core issues in `agentQuotaErrorWrapper.ts` and agent model definitions:

1. **Trap on First Model**: `quotaErrorProcessor` returning `{ retry: true }` traps execution on the current model index, preventing Mastra from advancing to the next model in the `model` fallback array.
2. **Ineffective `process.env` Mutation**: Modifying `process.env.GOOGLE_API_KEY` at runtime has no effect on already initialized/cached `ModelRouterLanguageModel` instances in Mastra.

## Root Cause Analysis

- **Instance Caching**: `ModelRouterLanguageModel` resolves auth (`process.env.GOOGLE_API_KEY`) on initial creation and caches model instances in internal gateway caches. Re-evaluating `process.env` later does not update the HTTP headers of cached instances.
- **Processor Retry Loop**: When `quotaErrorProcessor` detects a 429 error and returns `{ retry: true }`, Mastra retries the _same active model index_ using the cached instance (which still holds the old key). It exhausts `maxRetries` on model 0 before failing, rather than cycling keys or advancing model fallback entries natively.

## Proposed Solution

Instead of mutating `process.env` inside an `ErrorProcessor`, expand the agent's `model` fallback array so that each model configuration explicitly includes an `apiKey` property.

### Architecture

```
[Agent Options]
      │
      ▼
withQuotaRotation / createQuotaAgent
      │
      ├─ Takes models: ['google/gemini-3.1-pro-preview', 'google/gemini-2.5-pro']
      ├─ Takes API_KEYS: [KEY_1, KEY_2, KEY_3...]
      │
      ▼
Expands into Mastra Fallback Array:
  1. gemini-3.1-pro-preview (apiKey: KEY_1) ──[429 Quota]──► Mastra Native Fallback
  2. gemini-3.1-pro-preview (apiKey: KEY_2) ──[429 Quota]──► Mastra Native Fallback
  3. gemini-3.1-pro-preview (apiKey: KEY_3) ──[429 Quota]──► Mastra Native Fallback
  4. gemini-2.5-pro         (apiKey: KEY_1) ──[429 Quota]──► Mastra Native Fallback
  5. gemini-2.5-pro         (apiKey: KEY_2) ...
```

## Actionable Steps

### 1. Update `agentQuotaErrorWrapper.ts`

- Remove `quotaErrorProcessor` and the dynamic `changeGoogleApiKey` process.env mutation.
- Export helper function `buildQuotaRotatedModels(models, apiKeys)` that transforms single model strings or arrays of `ModelWithRetries` into a flattened array where each model entry is paired with each available API key.
- Update `createQuotaAgent` to wrap options and automatically apply `buildQuotaRotatedModels` to `options.model`.

### 2. Verify and Update Agent Configurations

- Update [`src/mastra/agents/testAgent.ts`](src/mastra/agents/testAgent.ts:24) to test model array rotation.
- Verify existing agents (`fileParserAgent`, `categoryQualityJudgeAgent`, `categoryResearcherAgent`, `categoryCopywriterAgent`) continue using `createQuotaAgent`.

### 3. Verification

- Test key rotation and model fallback handling using `testAgent`.
