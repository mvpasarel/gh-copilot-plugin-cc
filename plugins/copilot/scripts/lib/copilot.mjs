/**
 * Copilot CLI interface.
 *
 * All interaction with the `copilot` binary goes through this module.
 * No daemon, no WebSocket, no IPC — each invocation spawns one CLI process,
 * parses JSONL stdout, and returns.
 */

import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readJsonFile } from "./fs.mjs";
import { binaryAvailable, terminateProcessTree } from "./process.mjs";

/** @type {string} Default model passed to `copilot --model`. */
const DEFAULT_MODEL = "gpt-5.4";

/** @type {string} Prompt used when resuming without explicit user text. */
const DEFAULT_CONTINUE_PROMPT =
  "Continue from the current session state. Pick the next highest-value step and follow through until the task is resolved.";

/** @type {string} Prefix for persistent task thread names. */
const TASK_THREAD_PREFIX = "Copilot Companion Task";

// ── JSONL event types emitted by `copilot --output-format json` ──────────
const EVENT_SESSION_START = "session.start";
const EVENT_ASSISTANT_MESSAGE = "assistant.message";
const EVENT_ASSISTANT_MESSAGE_DELTA = "assistant.message_delta";
const EVENT_ASSISTANT_REASONING_DELTA = "assistant.reasoning_delta";
const EVENT_TOOL_EXECUTION_START = "tool.execution_start";
const EVENT_TOOL_EXECUTION_COMPLETE = "tool.execution_complete";
const EVENT_RESULT = "result";

function shorten(text, limit = 72) {
  const normalized = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "";
  }
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit - 3)}...`;
}

export { DEFAULT_CONTINUE_PROMPT };

// ── Availability and auth ────────────────────────────────────────────────

/**
 * Check whether the `copilot` binary is on PATH and responds to `--version`.
 */
export function getCopilotAvailability(cwd) {
  return binaryAvailable("copilot", ["--version"], { cwd });
}

/**
 * Check whether the Copilot CLI is installed *and* authenticated.
 *
 * The CLI has no `--status` flag, so we read `~/.copilot/config.json`
 * directly and look for `copilot_tokens` + `logged_in_users`.
 */
export function getCopilotLoginStatus(cwd) {
  const availability = getCopilotAvailability(cwd);
  if (!availability.available) {
    return { available: false, loggedIn: false, detail: availability.detail };
  }

  const configPath = path.join(os.homedir(), ".copilot", "config.json");
  const config = safeReadJson(configPath);
  if (!config) {
    return { available: true, loggedIn: false, detail: "no config found — run `copilot login`" };
  }

  const tokens = config.copilot_tokens ?? {};
  const users = config.logged_in_users ?? [];
  if (Object.keys(tokens).length > 0 && users.length > 0) {
    const login = users[0].login ?? "unknown";
    return { available: true, loggedIn: true, detail: `authenticated as ${login}` };
  }

  return { available: true, loggedIn: false, detail: "not authenticated — run `copilot login`" };
}

/**
 * Report the session runtime mode. Copilot is always "direct" — one CLI
 * process per invocation, no app-server or broker.
 */
export function getSessionRuntimeStatus(env = process.env) {
  return {
    label: "direct (copilot CLI)",
    mode: "direct",
    available: true
  };
}

// ── CLI argument builder ───��───────────────────────��─────────────────────

/**
 * Build the argument array for a `copilot -p <prompt>` invocation.
 *
 * Supported CLI flags:
 * - `-p`               Non-interactive prompt mode
 * - `--silent`         Suppress stats output
 * - `--no-ask-user`    No interactive prompts
 * - `--model`          Model selection
 * - `--output-format`  JSONL event stream
 * - `--allow-all-tools` Write-capable tasks
 * - `--effort`         Reasoning effort (low/medium/high/xhigh)
 * - `--resume=<id>`    Continue a previous session
 * - `--autopilot`      Self-continue for multi-step tasks
 * - `--max-autopilot-continues` Cap on self-continues
 */
function buildCopilotArgs(prompt, options = {}) {
  const args = ["-p", prompt, "--output-format", "json", "--silent", "--no-ask-user"];

  const model = options.model ?? DEFAULT_MODEL;
  args.push("--model", model);

  if (options.effort) {
    args.push("--effort", options.effort);
  }

  if (options.sandbox === "workspace-write" || options.allowAllTools) {
    args.push("--allow-all-tools");
  }

  if (options.resumeSessionId) {
    args.push(`--resume=${options.resumeSessionId}`);
  }

  if (options.autopilot) {
    args.push("--autopilot");
    if (options.maxContinues) {
      args.push("--max-autopilot-continues", String(options.maxContinues));
    }
  }

  return args;
}

// ── JSONL parsing ─────────��──────────────────────────────────────────────

function parseJsonlLine(line) {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * Parse JSONL stdout from a `copilot -p` invocation.
 *
 * Extracts the last `assistant.message` content as the final message,
 * collects tool executions, and picks up the session ID from
 * `session.start` or `result` events.
 */
export function parseCopilotJsonlOutput(stdout) {
  const lines = stdout.split("\n");
  let finalMessage = "";
  let sessionId = null;
  const reasoningSummary = [];
  const toolExecutions = [];
  let lastAssistantContent = "";

  for (const line of lines) {
    const event = parseJsonlLine(line);
    if (!event) {
      continue;
    }

    switch (event.type) {
      case EVENT_ASSISTANT_MESSAGE: {
        const content = event.data?.content ?? "";
        if (content) {
          lastAssistantContent = content;
        }
        break;
      }
      case EVENT_ASSISTANT_MESSAGE_DELTA:
      case EVENT_ASSISTANT_REASONING_DELTA:
        break;
      case EVENT_TOOL_EXECUTION_START:
      case EVENT_TOOL_EXECUTION_COMPLETE:
        toolExecutions.push(event);
        break;
      case EVENT_RESULT:
        sessionId = event.data?.sessionId ?? sessionId;
        break;
      case EVENT_SESSION_START:
        sessionId = event.data?.sessionId ?? sessionId;
        break;
      default:
        break;
    }
  }

  finalMessage = lastAssistantContent;

  return {
    finalMessage,
    sessionId,
    reasoningSummary,
    toolExecutions
  };
}

// ── Process spawning ─────────────────────────────────────────────────────

function spawnCopilotProcess(cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn("copilot", args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      resolve({
        exitCode: code ?? 1,
        stdout,
        stderr,
        pid: child.pid
      });
    });
  });
}

// ── High-level runners ───────────────────────────────────────────────────

/**
 * Run a single Copilot turn: build args, spawn the CLI, parse output.
 */
export async function runCopilotTurn(cwd, options = {}) {
  const prompt = options.prompt || options.defaultPrompt || "";
  if (!prompt && !options.resumeSessionId) {
    throw new Error("Provide a prompt or a session to resume.");
  }

  const effectivePrompt = prompt || options.defaultPrompt || DEFAULT_CONTINUE_PROMPT;

  let outputSchemaInstruction = "";
  if (options.outputSchema) {
    const schemaText = typeof options.outputSchema === "string"
      ? options.outputSchema
      : JSON.stringify(options.outputSchema, null, 2);
    outputSchemaInstruction = `\n\nReturn ONLY valid JSON matching this schema:\n${schemaText}\n`;
  }

  const fullPrompt = outputSchemaInstruction
    ? `${effectivePrompt}${outputSchemaInstruction}`
    : effectivePrompt;

  const args = buildCopilotArgs(fullPrompt, options);

  const onProgress = options.onProgress;
  if (onProgress) {
    onProgress({ message: "Starting Copilot CLI.", phase: "starting" });
  }

  const result = await spawnCopilotProcess(cwd, args);

  if (onProgress) {
    onProgress({ message: "Copilot CLI finished.", phase: "finalizing" });
  }

  const parsed = parseCopilotJsonlOutput(result.stdout);

  const finalMessage = parsed.finalMessage || result.stdout.split("\n")
    .filter((line) => !line.trim().startsWith("{"))
    .join("\n")
    .trim();

  return {
    status: result.exitCode,
    threadId: parsed.sessionId,
    turnId: null,
    finalMessage,
    reasoningSummary: parsed.reasoningSummary,
    stderr: result.stderr,
    error: result.exitCode !== 0 ? { message: result.stderr.trim() || `copilot exited with code ${result.exitCode}` } : null,
    touchedFiles: [],
    fileChanges: [],
    commandExecutions: []
  };
}

/**
 * Run a Copilot review turn. Same as `runCopilotTurn` — the CLI handles
 * the `/review` prompt internally.
 */
export async function runCopilotReview(cwd, options = {}) {
  return runCopilotTurn(cwd, options);
}

// ── Structured output parsing ────────────────────────────────────────────

/**
 * Try to extract structured JSON from Copilot's free-form text output.
 * Handles fenced code blocks, bare JSON, and partial extraction.
 */
export function parseStructuredOutput(rawOutput, context = {}) {
  const text = String(rawOutput ?? "").trim();
  if (!text) {
    return {
      parsed: null,
      rawOutput: text,
      parseError: context.failureMessage || "No output received."
    };
  }

  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  const candidate = jsonMatch ? jsonMatch[1].trim() : text;

  try {
    const parsed = JSON.parse(candidate);
    return { parsed, rawOutput: text, parseError: null };
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      try {
        const parsed = JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
        return { parsed, rawOutput: text, parseError: null };
      } catch {
        // Fall through
      }
    }

    return {
      parsed: null,
      rawOutput: text,
      parseError: `Could not parse JSON from Copilot output. ${context.failureMessage ?? ""}`.trim()
    };
  }
}

/**
 * Read and parse a JSON schema file, returning null on failure.
 */
export function readOutputSchema(schemaPath) {
  try {
    return readJsonFile(schemaPath);
  } catch {
    return null;
  }
}

/**
 * Find the latest task session for a workspace. Returns null — Copilot
 * sessions are tracked only through job state, not the CLI itself.
 */
export function findLatestTaskSession(workspaceRoot) {
  return null;
}

/**
 * Build a human-readable thread name from a task prompt excerpt.
 */
export function buildPersistentTaskThreadName(prompt) {
  const excerpt = shorten(prompt, 56);
  return excerpt ? `${TASK_THREAD_PREFIX}: ${excerpt}` : TASK_THREAD_PREFIX;
}

/**
 * Best-effort cancellation of a running Copilot process.
 * Killing a detached wrapper may not always reach the Copilot child on
 * every platform — this is documented as best-effort.
 */
export function interruptCopilotProcess(pid) {
  return terminateProcessTree(pid);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function safeReadJson(filePath) {
  try {
    return readJsonFile(filePath);
  } catch {
    return null;
  }
}
