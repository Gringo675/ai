# 03 — Judge Evaluation Loop and State Schema

**What to build:** Quality audit and automated correction feedback loop (`dountil`) for generated characteristics. A specialized Judge agent evaluates compliance with the formatting policy, HTML validity, link precision, and zero fluff. The workflow persists a complete state snapshot (`storeSchema`) including original data, document extractions, critique, and failed attempt history to enable full transparency and future human revisions.

**Blocked by:** 02 — Characteristics Policy and Document Pipeline

**Status:** ready-for-agent

- [ ] A dedicated characteristics judge agent is configured with structured output evaluation schema
- [ ] A `dountil` feedback loop executes up to 3 attempts when judge returns `FAIL`
- [ ] On failure, actionable critique and required corrections are injected into the copywriter prompt for regeneration
- [ ] The workflow state (`storeSchema`) preserves `originalData` (including existing `characteristics`), all document extractions, fallback flag, judge verdict, critique, and failed attempts history
