# GitHub Copilot Plugin for Claude Code

## Project Structure

- `plugins/copilot/` — GitHub Copilot plugin. Self-contained, no external dependencies.
- `.claude/agents/` — Custom subagents for architecture and code review.
- `tests/` — Test suite using Node.js native test runner.

## Plugin Development Rules

1. `plugins/copilot/` must be self-contained. No modifications outside the plugin directory affect runtime.
2. Prefer thin wrappers over abstractions. If code is used once, inline it.
3. All commands under `/copilot:*` namespace.
4. Background jobs use `~/.claude/plugins/data/copilot/` for state.
5. Scripts are ESM (.mjs), no build step, no dependencies beyond Node.js stdlib.

## Commands

- `/copilot:setup` — Verify Copilot CLI installed and authenticated
- `/copilot:review` — Native Copilot code review
- `/copilot:adversarial-review` — Steerable challenge review
- `/copilot:rescue` — Delegate tasks to Copilot
- `/copilot:status` — Check job status
- `/copilot:result` — Retrieve completed job output
- `/copilot:cancel` — Cancel a running job
