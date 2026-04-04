---
description: Check whether the local Copilot CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*), AskUserQuestion
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" setup --json $ARGUMENTS
```

If the result says Copilot is unavailable:
- Tell the user to install the Copilot CLI from https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line
- Do not attempt to install it automatically — the Copilot CLI is a standalone binary, not an npm package.

If Copilot is installed but not authenticated:
- Preserve the guidance to run `!copilot login`.

Output rules:
- Present the final setup output to the user.
