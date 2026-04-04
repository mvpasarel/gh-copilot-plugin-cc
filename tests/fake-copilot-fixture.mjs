/**
 * Fake Copilot CLI fixture for testing.
 *
 * Unlike the real Copilot CLI which is a full application, this fixture
 * is a simple Node.js script that:
 * - Responds to `copilot --version` with a version string
 * - Responds to `copilot -p <prompt> ...` by emitting JSONL events to stdout
 * - Supports behavioral modes: review-ok, adversarial-findings, task-ok, auth-fail
 * - Writes call state to a JSON file for test assertions
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { writeExecutable } from "./helpers.mjs";

/**
 * Install a fake `copilot` binary into the given directory.
 * Also creates a fake `~/.copilot/config.json` for auth checks.
 */
export function installFakeCopilot(binDir, behavior = "review-ok") {
  const statePath = path.join(binDir, "fake-copilot-state.json");
  const configDir = path.join(binDir, "fake-copilot-home", ".copilot");
  fs.mkdirSync(configDir, { recursive: true });

  // Write a fake auth config that getCopilotLoginStatus will find
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify({
      copilot_tokens: { "github.com": "fake-token" },
      logged_in_users: [{ login: "test-user" }]
    }),
    "utf8"
  );

  const scriptPath = path.join(binDir, "copilot");
  const source = `#!/usr/bin/env node
const fs = require("node:fs");
const STATE_PATH = ${JSON.stringify(statePath)};
const BEHAVIOR = ${JSON.stringify(behavior)};

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function jsonl(obj) {
  process.stdout.write(JSON.stringify(obj) + "\\n");
}

const args = process.argv.slice(2);

// Record call for test assertions
saveState({ args, behavior: BEHAVIOR, calledAt: new Date().toISOString() });

// Handle --version
if (args.includes("--version")) {
  process.stdout.write("copilot version 1.0.0-fake\\n");
  process.exit(0);
}

// Handle -p (prompt mode)
const promptIndex = args.indexOf("-p");
if (promptIndex === -1) {
  process.stderr.write("fake-copilot: expected -p flag\\n");
  process.exit(1);
}

const prompt = args[promptIndex + 1] || "";

switch (BEHAVIOR) {
  case "review-ok":
    jsonl({ type: "session.start", data: { sessionId: "fake-sess-001" } });
    if (prompt === "/review") {
      jsonl({ type: "assistant.message", data: { content: "Reviewed uncommitted changes. No material issues found." } });
    } else {
      // Structured adversarial review
      const result = {
        verdict: "needs-attention",
        summary: "Missing empty-state guard on array access.",
        findings: [{
          severity: "medium",
          title: "Missing empty-state guard",
          body: "Array access without length check can throw on empty input.",
          file: "src/app.js",
          line_start: 1,
          line_end: 1,
          confidence: 0.85,
          recommendation: "Add a length check before accessing array elements."
        }],
        next_steps: ["Add guard clause for empty arrays."]
      };
      jsonl({ type: "assistant.message", data: { content: JSON.stringify(result) } });
    }
    jsonl({ type: "result", data: { sessionId: "fake-sess-001" } });
    break;

  case "task-ok":
    jsonl({ type: "session.start", data: { sessionId: "fake-sess-task-001" } });
    jsonl({ type: "assistant.message", data: { content: "Task completed successfully. Fixed the issue." } });
    jsonl({ type: "result", data: { sessionId: "fake-sess-task-001" } });
    break;

  case "auth-fail":
    process.stderr.write("Error: not authenticated. Run copilot login.\\n");
    process.exit(1);

  case "slow-task":
    jsonl({ type: "session.start", data: { sessionId: "fake-sess-slow-001" } });
    // Simulate a task that takes a moment
    setTimeout(() => {
      jsonl({ type: "assistant.message", data: { content: "Slow task done." } });
      jsonl({ type: "result", data: { sessionId: "fake-sess-slow-001" } });
    }, 100);
    break;

  case "base-branch-review":
    jsonl({ type: "session.start", data: { sessionId: "fake-sess-branch-001" } });
    if (prompt === "/review") {
      jsonl({ type: "assistant.message", data: { content: "Reviewed changes against main. No material issues found." } });
    } else {
      const branchResult = {
        verdict: "needs-attention",
        summary: "Missing empty-state guard on array access.",
        findings: [{
          severity: "medium",
          title: "Missing empty-state guard",
          body: "Array access without length check.",
          file: "src/app.js",
          line_start: 1,
          line_end: 1,
          confidence: 0.85,
          recommendation: "Add a length check."
        }],
        next_steps: ["Add guard clause."]
      };
      jsonl({ type: "assistant.message", data: { content: JSON.stringify(branchResult) } });
    }
    jsonl({ type: "result", data: { sessionId: "fake-sess-branch-001" } });
    break;

  default:
    jsonl({ type: "session.start", data: { sessionId: "fake-sess-default" } });
    jsonl({ type: "assistant.message", data: { content: "Default response." } });
    jsonl({ type: "result", data: { sessionId: "fake-sess-default" } });
}
`;

  writeExecutable(scriptPath, source);

  return {
    binDir,
    statePath,
    configDir: path.dirname(configDir)
  };
}

/**
 * Build a test environment that uses the fake copilot binary
 * and fake home directory for auth config.
 */
export function buildEnv(binDir) {
  const fakeHome = path.join(binDir, "fake-copilot-home");
  return {
    ...process.env,
    PATH: `${binDir}${path.delimiter}${process.env.PATH}`,
    HOME: fakeHome,
    USERPROFILE: fakeHome
  };
}
