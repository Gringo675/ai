---
Status: ready-for-agent
---

# Specification: Document Product Extractor Agent

## Problem Statement

Large official technical documents (such as GOST standards, type approval certificates, and technical specifications) contain extensive boilerplate text, administrative introductions, and descriptions for dozens of models or modifications. When generating product category descriptions or content, operators and automated pipelines need to extract only the precise technical information and specifications relevant to a specific subset of products belonging to a category, without manual filtering of large documents.

## Solution

Create a specialized Mastra agent (`documentProductExtractorAgent`) that takes the full text of an official technical document along with an explicit list of target products (`products`), and extracts only the relevant technical details, filtering out irrelevant models and bureaucratic boilerplate. The agent returns a clean, structured Markdown (`.md`) document containing reconstructed tables and exact parameters tailored specifically to the target products.

## User Stories

1. As a content pipeline operator, I want to pass a technical document and a list of target products to an AI agent, so that I receive a concise, filtered Markdown summary containing only relevant information for those products.
2. As an automated workflow, I want the agent to filter and reconstruct tables (such as GOST specification matrices) so that only models matching the target product list are retained.
3. As a system administrator, I want the agent to be built using Mastra's agent framework with multi-API-key rotation and fallback capabilities, ensuring high availability and resilience against rate limits.
4. As a technical validator, I want the agent instructions to strictly prohibit hallucination or modification of numerical values, measuring ranges, accuracy classes, and tolerances, ensuring absolute metrological accuracy.
5. As a developer, I want the agent to process the full document text directly without requiring complex pre-chunking, leveraging the large context window of modern LLMs.
6. As a system integrator, I want the agent to be properly registered in the Mastra application instance alongside existing agents, tools, and workflows.

## Implementation Decisions

- **Agent Module**: Implement `documentProductExtractorAgent` using `createMultiKeyAgent` to ensure robust multi-key fallback rotation.
- **Prompt Architecture**: Maintain agent instructions in a dedicated prompt markdown file (`documentProductExtractor.md`), establishing clear rules for role, focused extraction, table reconstruction, precision of technical parameters, and Markdown output formatting.
- **API & Data Contracts**: 
  - Input payload: Document reference (number and name), full document text (`text`), and target products array (`products[]`).
  - Output format: Clean, structured Markdown text (`.md`) containing only product-relevant specifications.
- **Integration Seam**: Register the agent in `src/mastra/index.ts` under `agents` so it can be invoked by workflows, tools, or API endpoints.
- **Local API Source**: Utilize the existing local API endpoint `http://localhost:3000/api/ai/categoryData/{alias}` for fetching category data and document arrays during testing and execution.

## Testing Decisions

- **External Behavior Testing**: Test the agent by supplying sample document text and a restricted product list, verifying that output Markdown successfully filters out unrequested models and retains correct parameters.
- **Accuracy Verification**: Verify that numerical values, GOST numbers, and measurement tolerances match the source document without distortion or hallucination.
- **Prior Art**: Follow existing agent implementation patterns (`categoryResearcherAgent`, `fileParserAgent`) and multi-key fallback architecture (`multiKeyAgent.ts`).

## Out of Scope

- Automated document text chunking or pre-splitting (full document text is processed directly).
- Modifications or backend logic changes to the local category data API server.
- Automatic generation of final category descriptions (handled by downstream copywriter agents).

## Further Notes

- This agent serves as a foundational component for automated category content generation pipelines, enabling precise data extraction from regulatory standards and type approval descriptions.
