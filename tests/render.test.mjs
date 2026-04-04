import test from "node:test";
import assert from "node:assert/strict";

import { renderReviewResult, renderStoredJobResult } from "../plugins/copilot/scripts/lib/render.mjs";

test("renderReviewResult degrades gracefully when JSON is missing required review fields", () => {
  const output = renderReviewResult(
    {
      parsed: {
        verdict: "approve",
        summary: "Looks fine."
      },
      rawOutput: JSON.stringify({
        verdict: "approve",
        summary: "Looks fine."
      }),
      parseError: null
    },
    {
      reviewLabel: "Adversarial Review",
      targetLabel: "working tree diff"
    }
  );

  assert.match(output, /Copilot returned JSON with an unexpected review shape\./);
  assert.match(output, /Missing array `findings`\./);
  assert.match(output, /Raw final message:/);
});

test("renderStoredJobResult prefers rendered output for structured review jobs", () => {
  const output = renderStoredJobResult(
    {
      id: "review-123",
      status: "completed",
      title: "Copilot Adversarial Review",
      jobClass: "review",
      threadId: "sess-123"
    },
    {
      threadId: "sess-123",
      rendered: "# Copilot Adversarial Review\n\nTarget: working tree diff\nVerdict: needs-attention\n",
      result: {
        result: {
          verdict: "needs-attention",
          summary: "One issue.",
          findings: [],
          next_steps: []
        },
        rawOutput:
          '{"verdict":"needs-attention","summary":"One issue.","findings":[],"next_steps":[]}'
      }
    }
  );

  assert.match(output, /# Copilot Adversarial Review/);
  assert.match(output, /Copilot session ID: sess-123/);
  assert.match(output, /copilot --resume=sess-123/);
});

test("renderStoredJobResult falls back to rawOutput when rendered is missing", () => {
  const output = renderStoredJobResult(
    {
      id: "task-456",
      status: "completed",
      title: "Copilot Task",
      threadId: "sess-456"
    },
    {
      threadId: "sess-456",
      result: {
        rawOutput: "Task completed successfully."
      }
    }
  );

  assert.match(output, /Task completed successfully\./);
  assert.match(output, /copilot --resume=sess-456/);
});

test("renderStoredJobResult shows error when no output is stored", () => {
  const output = renderStoredJobResult(
    {
      id: "task-789",
      status: "failed",
      title: "Copilot Task",
      summary: "Debug the flaky test"
    },
    {
      errorMessage: "copilot exited with code 1"
    }
  );

  assert.match(output, /copilot exited with code 1/);
});
