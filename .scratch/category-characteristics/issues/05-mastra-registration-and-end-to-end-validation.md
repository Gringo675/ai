# 05 — Mastra Registration and End-to-End Validation

**What to build:**
Register the new agents and `categoryCharacteristics` workflow in `src/mastra/index.ts`. Run comprehensive end-to-end tests for both document-rich categories (e.g. `mikrometry-mk-gladkie`) and document-less categories (e.g. `tsirkuli-razmetochnye`), ensuring clean HTML generation, valid links, no hallucinations, and full state preservation.

**Blocked by:** 04 — Fallback Research Branch for Categories Without Documents

**Status:** ready-for-agent

- [x] All new agents (`categoryCharacteristicsResearcherAgent`, `categoryCharacteristicsCopywriterAgent`, `categoryCharacteristicsQualityJudgeAgent`) and `categoryCharacteristics` workflow are exported and registered in `src/mastra/index.ts`.
- [x] End-to-end run succeeds on category with documents (`mikrometry-mk-gladkie`): documents are sorted from newest to oldest, tables generated in HTML `<table>`, links formatted with `doc-viewer-link` and correct paths.
- [x] End-to-end run succeeds on category without documents (`tsirkuli-razmetochnye`): fallback research gathers technical data from `availableProps` and Tavily, producing a valid HTML table without broken local links.
- [x] Output conforms to full `categoryCharacteristicsStoreSchema` for transparency and future revisions.
