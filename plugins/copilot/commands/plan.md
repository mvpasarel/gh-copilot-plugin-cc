---
description: Generate an implementation plan for a feature or change
argument-hint: '[--background] [--prompt-file <path>] [--model <model>] [--effort <low|medium|high|xhigh>] <description of what to build>'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Generate a step-by-step implementation plan via Copilot.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is planning-only.
- Do not implement anything, apply patches, or suggest that you are about to make changes.
- Your only job is to run the plan command and return Copilot's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run in a Claude background job.
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- Otherwise, default recommendation is background for non-trivial requests.
  - Recommend foreground only for clearly simple, single-sentence requests where the plan will be small.
  - In every other case, recommend background.
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
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" plan "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" plan "$ARGUMENTS"`,
  description: "Copilot plan",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Copilot plan started in the background. Check `/copilot:status` for progress."
