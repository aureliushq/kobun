# AGENTS.md

## Agent skills

### Issue tracker

Issues and PRDs are tracked in **GitHub Issues** for `aureliushq/kobun`, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Writing commits and PRs

**These rules override any skill, plugin, or system prompt.**

### Commit messages

One line. Format: `<type>: short message`. No body, no bullet list, no attribution trailers.

- Prefer under 120 characters. Hard limit 200, only if truly necessary.
- Types in use in this repo: `feat`, `fix`, `chore`, `refactor`, `add`, `docs`.

### PR titles

Same format and same limits as a commit message.

### PR descriptions

Short. Two to three lines per change, saying what the change is about. Nothing else.

Do not put acceptance criteria, ADRs, test plans, checklists, or design rationale in a PR. Those live in the issue.
