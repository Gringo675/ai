# Issue 01: Implement universal Mastra workflow `html-content-edit`

Status: ready-for-agent

## Description

Implement a universal Mastra workflow `html-content-edit` and an editor agent `htmlEditorAgent` designed to modify existing HTML texts based on user instructions. This workflow will be called by client applications (such as `aiCatCharacteristics.vue` in the site CMS) via the WebSocket adapter `/api/admin/mastraWsAdapter`.

## Acceptance Criteria

- [ ] Create `src/mastra/agents/htmlEditorAgent.ts`:
  - Model: Fast & reliable instruction-following LLM.
  - System prompt: Specialized in editing HTML texts strictly following instructions, maintaining valid semantic HTML tags, and returning raw HTML without markdown code blocks.
- [ ] Create `src/mastra/workflows/htmlContentEdit.ts`:
  - Input schema: `{ text: string, instruction: string }`.
  - Output schema: `{ modifiedText: string }`.
  - Step calls `htmlEditorAgent` and extracts the resulting HTML into `modifiedText`.
- [ ] Register `htmlContentEdit` in `src/mastra/index.ts`.
- [ ] Export workflow ID as `html-content-edit`.
- [ ] Test the workflow with representative input data.

## Context

Used by the site CMS at `app/pages/admin/cms/aiCatCharacteristics.vue` (and future pages like `aiCatDescription.vue`) for rapid, non-destructive editing of content without triggering heavy search/document extraction pipelines.
