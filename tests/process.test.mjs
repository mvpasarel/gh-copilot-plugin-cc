import test from "node:test";
import assert from "node:assert/strict";

import { terminateProcessTree } from "../plugins/copilot/scripts/lib/process.mjs";

test("terminateProcessTree uses taskkill on Windows", () => {
  let captured = null;
  const outcome = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl(command, args) {
      captured = { command, args };
      return {
        command,
        args,
        status: 0,
        signal: null,
        stdout: "",
        stderr: "",
        error: null
      };
    },
    killImpl() {
      throw new Error("kill fallback should not run");
    }
  });

  assert.deepEqual(captured, {
    command: "taskkill",
    args: ["/PID", "1234", "/T", "/F"]
  });
  assert.equal(outcome.delivered, true);
  assert.equal(outcome.method, "taskkill");
});

test("terminateProcessTree treats missing Windows processes as already stopped", () => {
  const outcome = terminateProcessTree(1234, {
    platform: "win32",
    runCommandImpl(command, args) {
      return {
        command,
        args,
        status: 128,
        signal: null,
        stdout: 'ERROR: The process "1234" not found.',
        stderr: "",
        error: null
      };
    }
  });

  assert.equal(outcome.delivered, false);
  assert.equal(outcome.method, "taskkill");
});

test("terminateProcessTree uses process group kill on Unix", () => {
  let killedPid = null;
  let killedSignal = null;

  const outcome = terminateProcessTree(5678, {
    platform: "linux",
    killImpl(pid, signal) {
      killedPid = pid;
      killedSignal = signal;
    }
  });

  assert.equal(killedPid, -5678);
  assert.equal(killedSignal, "SIGTERM");
  assert.equal(outcome.delivered, true);
  assert.equal(outcome.method, "process-group");
});

test("terminateProcessTree returns attempted=false for non-finite pid", () => {
  const outcome = terminateProcessTree(NaN);
  assert.equal(outcome.attempted, false);
  assert.equal(outcome.delivered, false);
});
