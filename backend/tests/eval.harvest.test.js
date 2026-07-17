import { describe, test, expect } from "vitest";
import { parseCommitsToCandidates } from "../src/scripts/harvest-eval-set.js";

describe("parseCommitsToCandidates", () => {
  test("turns git log lines into candidate eval cases with sequential ids", () => {
    const lines = [
      "abc123|def456|add refresh token endpoint",
      "def456|111aaa|fix login redirect bug",
    ];

    const candidates = parseCommitsToCandidates(lines);

    expect(candidates).toEqual([
      {
        id: "eval-001",
        task: { title: "add refresh token endpoint", description: "" },
        headSha: "abc123",
        baseSha: "def456",
        prNumber: null,
        label: null,
        bucket: null,
        missingRequirements: [],
        notes: "",
      },
      {
        id: "eval-002",
        task: { title: "fix login redirect bug", description: "" },
        headSha: "def456",
        baseSha: "111aaa",
        prNumber: null,
        label: null,
        bucket: null,
        missingRequirements: [],
        notes: "",
      },
    ]);
  });

  test("skips merge commits (multiple parents) — no single base to diff against", () => {
    const lines = [
      "abc123|def456 789xyz|Merge branch 'main'",
      "def456|111aaa|real change",
    ];

    const candidates = parseCommitsToCandidates(lines);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].task.title).toBe("real change");
  });

  test("skips the root commit (no parent at all)", () => {
    const lines = ["abc123||initial commit"];

    expect(parseCommitsToCandidates(lines)).toHaveLength(0);
  });

  test("returns an empty array for empty input", () => {
    expect(parseCommitsToCandidates([])).toEqual([]);
  });
});
