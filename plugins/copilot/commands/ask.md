---
description: Ask Copilot a one-shot question and return the answer verbatim
argument-hint: '<question or instruction>'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Ask Copilot a one-shot foreground question and return the answer verbatim.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is read-only and one-shot.
- Do not fix issues, apply patches, or suggest that you are about to make changes.
- Your only job is to run the command and return Copilot's output verbatim to the user.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" ask "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.
- If the output is empty or the command exits with an error, show the error and suggest running `/copilot:setup` to verify Copilot is installed and authenticated.
