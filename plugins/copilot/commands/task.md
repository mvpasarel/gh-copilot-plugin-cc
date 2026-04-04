---
description: Delegate an agentic task to Copilot (foreground or background)
argument-hint: '[--background] [--write] [--resume|--resume-last|--fresh] [--model <model>] [--effort <low|medium|high|xhigh>] [prompt]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Delegate an agentic task to Copilot.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- Do not fix issues or apply patches yourself.
- Your only job is to invoke the companion script and return Copilot's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run the task in a Claude background job.
- If the raw arguments include `--wait`, do not ask. Run the task in the foreground.
- Otherwise, default recommendation is background (tasks tend to be large and long-running).
- Use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Run in background`
  - `Wait for results`

Argument handling:
- Preserve the user's arguments exactly.
- Do not strip `--background` or `--wait` yourself.
- The companion script parses `--background`, but Claude Code's `Bash(..., run_in_background: true)` is what actually detaches the run.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" task "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch the task with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" task "$ARGUMENTS"`,
  description: "Copilot task",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Copilot task started in the background. Check `/copilot:status` for progress."
