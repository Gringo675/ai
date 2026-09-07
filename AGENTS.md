# AGENTS.md

## Rules

- Register all agents, tools, workflows, and scorers in `src/mastra/index.ts`
- Do not run `npm run build` or `npm run dev`, as it breaks the already running dev server.
- Create git commits only after explicit user approval.

## Resources

- [Mastra Documentation](https://mastra.ai/llms.txt)
- [Skills Discovery](https://mastra.ai/.well-known/skills/index.json)

## Agent skills

### Issue tracker

Issues and specs live as markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The canonical five roles (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo layout (`CONTEXT.md` and `docs/adr/`). See `docs/agents/domain.md`.
