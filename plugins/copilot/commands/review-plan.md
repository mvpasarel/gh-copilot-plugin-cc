---
description: Review a plan for correctness, completeness, and feasibility
argument-hint: '[--background] [--plan-file <path>] [--model <model>] [--effort <low|medium|high|xhigh>] [plan text ...]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Review an implementation plan via Copilot.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues in the plan, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return Copilot's output verbatim to the user.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run in a Claude background job.
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- Otherwise, default recommendation is background for plans of non-trivial size.
  - Recommend foreground only for clearly small, simple plans.
  - In every other case, recommend background.
- Use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Plan content can be passed as positional arguments, via `--plan-file <path>`, or piped via stdin.
- Do not strip `--background` or `--wait` yourself.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" review-plan "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" review-plan "$ARGUMENTS"`,
  description: "Copilot plan review",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Copilot plan review started in the background. Check `/copilot:status` for progress."
