import { describe, it, expect } from "vitest";
import { parseTaskKey } from "../src/utils/task-key-parser.js";

// Table from plans/ai-dod-plan.md §3.2 — precedence: PR title -> branch -> PR body.
// The prefix must match keyPrefix ∪ prefixAliases on the resolved project,
// case-insensitively; a mismatch is a miss, never a cross-project lookup
// (the prefix is a typo guard, not a router — PRD §6.1).

describe("parseTaskKey", () => {
  const project = { keyPrefix: "PC", prefixAliases: ["CAMP"] };

  it("matches the current prefix in a branch name", () => {
    const result = parseTaskKey({ branch: "feature/PC-104-short-description" }, project);
    expect(result).toEqual({ taskNumber: 104, source: "branch" });
  });

  it("matches a retired prefix via prefixAliases after a rename", () => {
    const result = parseTaskKey({ branch: "feature/CAMP-104-x" }, project);
    expect(result).toEqual({ taskNumber: 104, source: "branch" });
  });

  it("misses on a prefix that belongs to neither keyPrefix nor prefixAliases (typo guard, never cross-project)", () => {
    const result = parseTaskKey({ branch: "feature/JIRA-500-migrate" }, project);
    expect(result).toBeNull();
  });

  it("matches a lowercase branch prefix case-insensitively", () => {
    const result = parseTaskKey({ branch: "feature/pc-104-x" }, project);
    expect(result).toEqual({ taskNumber: 104, source: "branch" });
  });

  it("takes the task number, not an unrelated number later in the branch name", () => {
    const result = parseTaskKey({ branch: "feature/PC-104-fix-issue-99" }, project);
    expect(result.taskNumber).toBe(104);
  });

  it("returns null when there's no key anywhere", () => {
    const result = parseTaskKey({ branch: "feature/misc-cleanup" }, project);
    expect(result).toBeNull();
  });

  it("PR title takes precedence over branch", () => {
    const result = parseTaskKey(
      { branch: "feature/PC-104-x", prTitle: "[PC-200] Clear title" },
      project,
    );
    expect(result).toEqual({ taskNumber: 200, source: "pr_title" });
  });

  it("falls through to branch when the PR title has no key", () => {
    const result = parseTaskKey(
      { branch: "feature/PC-104-x", prTitle: "Clear title with no key" },
      project,
    );
    expect(result).toEqual({ taskNumber: 104, source: "branch" });
  });

  it("falls through to PR body (Closes PC-300) when title and branch have no key", () => {
    const result = parseTaskKey(
      {
        branch: "misc-cleanup",
        prTitle: "Clear title with no key",
        prBody: "This change closes PC-300 once merged.",
      },
      project,
    );
    expect(result).toEqual({ taskNumber: 300, source: "pr_body" });
  });

  it("PR body recognizes fixes/resolves as well as closes", () => {
    expect(
      parseTaskKey({ prBody: "Fixes PC-1" }, project),
    ).toEqual({ taskNumber: 1, source: "pr_body" });
    expect(
      parseTaskKey({ prBody: "Resolves PC-2" }, project),
    ).toEqual({ taskNumber: 2, source: "pr_body" });
  });
});
