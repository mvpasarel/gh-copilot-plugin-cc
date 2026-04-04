import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

import { initGitRepo, makeTempDir, run } from "./helpers.mjs";
import { resolveReviewTarget, getWorkingTreeState } from "../plugins/copilot/scripts/lib/git.mjs";

test("resolveReviewTarget detects working-tree scope when repo is dirty", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(`${repo}/file.txt`, "content\n");
  run("git", ["add", "file.txt"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });
  fs.writeFileSync(`${repo}/file.txt`, "changed\n");

  const target = resolveReviewTarget(repo);
  assert.equal(target.mode, "working-tree");
  assert.equal(target.label, "working tree diff");
});

test("resolveReviewTarget returns branch mode when --base is set", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(`${repo}/file.txt`, "content\n");
  run("git", ["add", "file.txt"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });

  const target = resolveReviewTarget(repo, { base: "main" });
  assert.equal(target.mode, "branch");
  assert.match(target.label, /branch diff against main/);
});

test("getWorkingTreeState reports untracked files", () => {
  const repo = makeTempDir();
  initGitRepo(repo);
  fs.writeFileSync(`${repo}/tracked.txt`, "tracked\n");
  run("git", ["add", "tracked.txt"], { cwd: repo });
  run("git", ["commit", "-m", "init"], { cwd: repo });
  fs.writeFileSync(`${repo}/untracked.txt`, "new\n");

  const state = getWorkingTreeState(repo);
  assert.equal(state.isDirty, true);
  assert.ok(state.untracked.includes("untracked.txt"));
});
