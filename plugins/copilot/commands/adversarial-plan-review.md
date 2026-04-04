---
description: Challenge a plan's assumptions, missing steps, and hidden dependencies
argument-hint: '[--background] --plan-file <path> [--focus <angle>] [--model <model>] [--effort <low|medium|high|xhigh>] [plan text or focus text]'
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Run an adversarial review of an implementation plan via Copilot.
Position it as a challenge review that questions the chosen approach, ordering, risk coverage, and hidden assumptions.
It is not just a stricter pass over plan completeness.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues in the plan, apply patches, or suggest that you are about to make changes.
- Your only job is to run the review and return Copilot's output verbatim to the user.
- Keep the framing focused on whether the plan's assumptions are sound, what it depends on implicitly, and where it would fail under real-world execution.

Execution mode rules:
- If the raw arguments include `--background`, do not ask. Run in a Claude background job.
- If the raw arguments include `--wait`, do not ask. Run in the foreground.
- Otherwise, estimate adversarial review effort:
  - Recommend waiting only when the plan is clearly tiny (1-3 steps, no significant risks mentioned).
  - In every other case, including unclear size, recommend background.
- Use `AskUserQuestion` exactly once with two options, putting the recommended option first and suffixing its label with `(Recommended)`:
  - `Wait for results`
  - `Run in background`

Argument handling:
- Preserve the user's arguments exactly.
- Plan content can be passed via `--plan-file <path>`, positional arguments, or stdin.
- When `--plan-file` is provided, positional arguments become adversarial focus text.
- When `--plan-file` is not provided, positional arguments are treated as plan content. Use `--focus <angle>` to specify the adversarial angle separately.
- Do not strip `--background` or `--wait` yourself.
- Do not weaken the adversarial framing or rewrite the user's focus text.

Foreground flow:
- Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" adversarial-plan-review "$ARGUMENTS"
```
- Return the command stdout verbatim, exactly as-is.
- Do not paraphrase, summarize, or add commentary before or after it.

Background flow:
- Launch with `Bash` in the background:
```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/copilot-companion.mjs" adversarial-plan-review "$ARGUMENTS"`,
  description: "Copilot adversarial plan review",
  run_in_background: true
})
```
- Do not call `BashOutput` or wait for completion in this turn.
- After launching the command, tell the user: "Copilot adversarial plan review started in the background. Check `/copilot:status` for progress."
