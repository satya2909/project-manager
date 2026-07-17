import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { extractEvidence } from "../src/dod/nodes/08-extract-evidence.js";
import { createRunState } from "../src/dod/state.js";

function state() {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
  });
  s.requirements = [{ id: "req1", text: "Route uses verifyJWT middleware" }];
  s.diff.text = "diff --git a/src/routes.js b/src/routes.js\n+router.use(verifyJWT)\n";
  s.files = [{ path: "src/routes.js", content: "router.use(verifyJWT)" }];
  return s;
}

describe("extractEvidence (Node 8)", () => {
  it("stores findings returned by the LLM and tracks token usage", async () => {
    const llmClient = vi.fn(async () => ({
      content: {
        findings: [
          {
            requirementId: "req1",
            status: "met",
            citations: [{ path: "src/routes.js", startLine: 1, endLine: 1, symbol: "verifyJWT" }],
            rationale: "found it",
          },
        ],
      },
      tokensUsed: 200,
    }));

    const s = await extractEvidence(state(), { llmClient });

    expect(s.exit).toBeNull();
    expect(s.findings).toHaveLength(1);
    expect(s.findings[0].status).toBe("met");
    expect(s.budget.tokensUsed).toBe(200);
    expect(s.budget.llmCalls).toBe(1);
  });

  it("downgrades a 'met' finding with zero citations to 'unmet' — met without a citation is invalid", async () => {
    const llmClient = vi.fn(async () => ({
      content: {
        findings: [{ requirementId: "req1", status: "met", citations: [], rationale: "trust me" }],
      },
      tokensUsed: 50,
    }));

    const s = await extractEvidence(state(), { llmClient });

    expect(s.findings[0].status).toBe("unmet");
  });

  it("fails open with PASSED_BY_SYSTEM_ERROR/LLM_TIMEOUT when the LLM call throws", async () => {
    const llmClient = vi.fn(async () => {
      throw new Error("LLM call failed after 3 attempts");
    });

    const s = await extractEvidence(state(), { llmClient });

    expect(s.exit).toEqual({ status: "PASSED_BY_SYSTEM_ERROR", errorCode: "LLM_TIMEOUT" });
  });

  it("wraps repo-derived content in <untrusted_repository_content> blocks in the prompt sent to the LLM", async () => {
    let capturedMessages;
    const llmClient = vi.fn(async ({ messages }) => {
      capturedMessages = messages;
      return { content: { findings: [] }, tokensUsed: 1 };
    });

    await extractEvidence(state(), { llmClient });

    const userContent = capturedMessages[0].content;
    expect(userContent).toContain("<untrusted_repository_content");
    expect(userContent).toContain("verifyJWT");
  });
});
