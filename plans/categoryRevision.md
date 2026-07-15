# Plan: Implement Category Revision Workflow

The goal is to create a one-shot revision workflow that allows a human editor to provide feedback on a generated category description and receive a revised version from the `categoryCopywriterAgent`.

## Todo List

- [ ] Implement the `revisionStep` in `src/mastra/workflows/categoryRevision.ts`
  - [ ] Build a prompt that includes:
    - Category Name, Original Description, Standards, and Filters.
    - SEO Research results.
    - The `categoryDescriptionPolicy.md` content.
    - The current `generatedDescription`.
    - The human's `revisionText` (editorial remarks).
  - [ ] Use `categoryCopywriterAgent.generate()` to produce the revised text.
- [ ] Define and export the `categoryRevision` workflow in `src/mastra/workflows/categoryRevision.ts`
  - [ ] Set `inputSchema` to `initialSchema`.
  - [ ] Set `outputSchema` to `outputSchema`.
  - [ ] Chain the `revisionStep`.
- [ ] Register `categoryRevision` workflow in `src/mastra/index.ts`
- [ ] Verify the implementation against the `categoryDescription.ts` reference to ensure prompt consistency.
