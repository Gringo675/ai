# 02 — Characteristics Policy and Document Pipeline

**What to build:** An end-to-end extraction and generation pipeline for categories with available documents. Implements the formatting policy, chronological sorting of documents (newest to oldest by year), sequential extraction via `documentProductExtractorAgent`, filtering of empty/irrelevant outputs, and generation of HTML characteristics with structured `<table>` markup and verified `doc-viewer-link` hyperlinks.

**Blocked by:** 01 — Protocol for Discarding Irrelevant Documents (`NO_RELEVANT_DATA`)

**Status:** ready-for-agent

- [x] A unified characteristics policy prompt is defined with strict HTML rules, `<table>` requirements, link patterns, chronological ordering, and zero-hallucination guardrails
- [x] A dedicated copywriter agent for category characteristics is configured with model fallback
- [x] The workflow fetches category data from API, detects documents with text, and deterministically sorts them by year descending
- [x] The workflow executes document extraction sequentially and drops results matching `NO_RELEVANT_DATA`
- [x] The copywriter produces valid HTML characteristics with accurate document titles, links, and tables
