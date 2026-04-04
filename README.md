# Copilot plugin for Claude Code

Use GitHub Copilot (GPT-5.4) from inside Claude Code for code reviews, adversarial reviews, or to delegate tasks.

This plugin is for Claude Code users who have a GitHub Copilot subscription and want GPT-5.4 as a second brain for code review and task delegation.

Each slash command costs at most 1 Copilot premium request. Status, result, cancel, and setup cost 0.

## What You Get

- `/copilot:review` for a native Copilot code review
- `/copilot:adversarial-review` for a steerable challenge review with structured findings
- `/copilot:rescue`, `/copilot:status`, `/copilot:result`, and `/copilot:cancel` to delegate work and manage background jobs
- `/copilot:ask` for quick one-shot questions
- `/copilot:task` for delegating agentic tasks (foreground or background)
- `/copilot:plan` for generating structured implementation plans
- `/copilot:review-plan` and `/copilot:adversarial-plan-review` for reviewing plans

## Requirements

- **GitHub Copilot subscription** with access to the [Copilot CLI](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line)
- **Node.js 18.18 or later**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add mvpasarel/gh-copilot-plugin-cc
```

Install the plugin:

```bash
/plugin install copilot@mvpasarel-copilot
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/copilot:setup
```

`/copilot:setup` will tell you whether the Copilot CLI is installed and authenticated.

If Copilot CLI is not installed, follow the [GitHub Copilot CLI docs](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-in-the-command-line) to install it.

If Copilot is installed but not logged in yet, run:

```bash
!copilot login
```

After install, you should see:

- the slash commands listed below
- the `copilot:copilot-rescue` subagent in `/agents`

One simple first run is:

```bash
/copilot:review --background
/copilot:status
/copilot:result
```

## Update

```bash
claude plugin update copilot@mvpasarel-copilot
```

Then restart Claude Code to apply.

## Usage

### `/copilot:setup`

Checks whether the Copilot CLI is installed and authenticated.

You can also use `/copilot:setup` to manage the optional review gate.

#### Enabling review gate

```bash
/copilot:setup --enable-review-gate
/copilot:setup --disable-review-gate
```

When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Copilot review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

> [!WARNING]
> The review gate costs 1 premium request per stop and can create a long-running Claude/Copilot loop. Only enable it when you plan to actively monitor the session.

### `/copilot:review`

Runs a native Copilot review on your current work. Copilot's built-in review agent automatically detects uncommitted changes, staged changes, and recent commits.

> [!NOTE]
> Code review especially for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--wait` and `--background`. It is not steerable and does not take custom focus text. Use [`/copilot:adversarial-review`](#copilotadversarial-review) when you want to challenge a specific decision or risk area.

Examples:

```bash
/copilot:review
/copilot:review --base main
/copilot:review --background
```

This command is read-only and will not perform any changes. When run in the background you can use [`/copilot:status`](#copilotstatus) to check on the progress and [`/copilot:cancel`](#copilotcancel) to cancel the ongoing task.

### `/copilot:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `/copilot:review`, including `--base <ref>` for branch review.
It also supports `--wait` and `--background`. Unlike `/copilot:review`, it can take extra focus text after the flags.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```bash
/copilot:adversarial-review
/copilot:adversarial-review --base main challenge whether this was the right caching and retry design
/copilot:adversarial-review --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `/copilot:rescue`

Hands a task to GPT-5.4 through the `copilot:copilot-rescue` subagent.

Use it when you want Copilot to:

- investigate a bug
- try a fix
- continue a previous Copilot session
- take a different perspective on a problem

> [!NOTE]
> Depending on the task and the model you choose these tasks might take a long time and it's generally recommended to force the task to be in the background or move the agent to the background.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest rescue session for this repo.

Examples:

```bash
/copilot:rescue investigate why the tests started failing
/copilot:rescue fix the failing test with the smallest safe patch
/copilot:rescue --resume apply the top fix from the last run
/copilot:rescue --effort medium investigate the flaky integration test
/copilot:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Copilot:

```text
Ask Copilot to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--effort`, Copilot uses its default
- follow-up rescue requests can continue the latest Copilot session in the repo

### `/copilot:ask`

One-shot foreground question to Copilot. Read-only, always foreground.

Supports `--model` and `--effort`.

Examples:

```bash
/copilot:ask what does the auth middleware do
/copilot:ask explain the retry logic in lib/http.mjs
```

Costs 1 premium request.

### `/copilot:task`

Delegate an agentic task to Copilot. Without `--write`, tasks run in a read-only sandbox.

Supports `--background`, `--write`, `--resume`, `--fresh`, `--model`, and `--effort`.

Examples:

```bash
/copilot:task refactor the error handling in lib/api.mjs
/copilot:task --background --write implement input validation for the signup form
```

Costs 1 premium request.

### `/copilot:plan`

Generate a structured implementation plan with steps, risks, and open questions. The output includes a verdict (`ready` or `needs-clarification`), ordered steps with file lists, risks, and open questions.

Supports `--background`, `--prompt-file`, `--model`, and `--effort`.

Examples:

```bash
/copilot:plan add WebSocket support to the notification system
/copilot:plan --prompt-file feature-spec.md
```

Costs 1 premium request.

### `/copilot:review-plan`

Review a plan for correctness, completeness, ordering, and feasibility. Plan content can be provided via positional args, `--plan-file <path>`, or stdin.

Supports `--background`, `--model`, and `--effort`.

Examples:

```bash
/copilot:review-plan --plan-file plan.md
/copilot:review-plan the plan is to add a caching layer in front of the database
```

### `/copilot:adversarial-plan-review`

Challenge a plan's assumptions, missing steps, and hidden dependencies. Plan content can be provided via `--plan-file <path>` or positional args. Use `--focus <angle>` with `--plan-file` to specify the adversarial angle.

Examples:

```bash
/copilot:adversarial-plan-review --plan-file plan.md
/copilot:adversarial-plan-review --plan-file plan.md --focus "what if the cache goes down"
```

### `/copilot:status`

Shows running and recent Copilot jobs for the current repository.

Examples:

```bash
/copilot:status
/copilot:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/copilot:result`

Shows the final stored output for a finished job.
When available, it also includes the Copilot session ID so you can resume that session with `copilot --resume=<session-id>`.

Examples:

```bash
/copilot:result
/copilot:result task-abc123
```

### `/copilot:cancel`

Cancels an active background Copilot job.

Examples:

```bash
/copilot:cancel
/copilot:cancel task-abc123
```

## Typical Flows

### Review Before Shipping

```bash
/copilot:review
```

### Hand A Problem To Copilot

```bash
/copilot:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/copilot:adversarial-review --background
/copilot:rescue --background investigate the flaky test
```

Then check in with:

```bash
/copilot:status
/copilot:result
```

### Quick Question

```bash
/copilot:ask what's the purpose of the retry logic in lib/http.mjs
```

### Plan Before Building

```bash
/copilot:plan add rate limiting to the API endpoints
```

### Delegate A Task

```bash
/copilot:task --background --write refactor the database connection pool
/copilot:status
/copilot:result
```

## Architecture

```
copilot -p "<prompt>" --silent --no-ask-user --model gpt-5.4 --output-format json
```

No daemon, no WebSocket, no IPC. Each command spawns one `copilot` CLI process, parses JSONL output, and returns. Background jobs are managed via state files in `~/.claude/plugins/data/copilot/`.

| Flag | Purpose |
|---|---|
| `-p` | Non-interactive prompt mode |
| `--silent` | Suppress stats output |
| `--no-ask-user` | No interactive prompts |
| `--model gpt-5.4` | Model selection |
| `--output-format json` | JSONL event stream |
| `--allow-all-tools` | Write-capable tasks |
| `--effort <level>` | Reasoning effort (low/medium/high/xhigh) |
| `--resume=<id>` | Continue a previous session |
| `--autopilot` | Self-continue for multi-step tasks |

## FAQ

### Do I need a separate account?

No. The plugin uses your local Copilot CLI authentication. If you are already signed into the Copilot CLI on this machine, it works immediately.

If you have not used the Copilot CLI before, run `copilot login` to authenticate with your GitHub account.

### How many premium requests does this use?

Each review, adversarial review, rescue, ask, task, or plan command uses exactly 1 Copilot premium request. Setup, status, result, and cancel use 0. The optional review gate uses 1 per stop.

## License

Apache-2.0. See [LICENSE](plugins/copilot/LICENSE).
