# Spec: Universal HTML Content Edit Workflow (`html-content-edit`)

## Overview

Create a new universal Mastra workflow `html-content-edit` in the AI project (`src/mastra/workflows/htmlContentEdit.ts`) to handle direct text/HTML modifications according to user instructions. This workflow is generic and intended for editing any CMS HTML content (category characteristics, category descriptions, product descriptions, etc.) without running heavy domain-specific extraction pipelines (like GOST/GRSI parsers) or multi-step quality judges.

## Requirements

### 1. Workflow Identifier
- Workflow ID: `html-content-edit`
- Registered in `src/mastra/index.ts` under `workflows: { ..., htmlContentEdit }`.

### 2. Input Schema
```typescript
z.object({
  text: z.string().describe('The current HTML/text content to be modified'),
  instruction: z.string().describe('The user edit instructions (e.g. format as table, make more concise, fix typos)'),
})
```

### 3. Output Schema
```typescript
z.object({
  modifiedText: z.string().describe('The updated, clean, valid HTML content with changes applied'),
})
```

### 4. Agent Configuration
- Dedicated agent or step: `htmlEditorAgent`.
- System instructions:
  - Input contains existing HTML content and an instruction describing desired changes.
  - Apply the requested modifications precisely.
  - Preserve valid HTML semantics (use appropriate elements: `<table>`, `<ul>`, `<li>`, `<p>`, `<strong>`, etc.).
  - Output ONLY clean HTML without markdown backticks (no ```html ... ```).
  - Do not introduce hallucinated facts or discard unchanged information unless instructed.

### 5. Verification
- Test workflow with sample category characteristics HTML and typical editing prompts (e.g. "Оформи таблицей", "Сделай кратко").
