import { describe, it, expect, vi } from "vitest";
import { evaluateWithRealPipeline } from "../eval/pipeline-adapter.js";

function evalCase(overrides = {}) {
  return {
    id: "eval-test-1",
    task: { title: "add JWT check", description: "Protect the route with verifyJWT." },
    headSha: "sha1",
    baseSha: "sha0",
    prNumber: null,
    label: "should_approve",
    bucket: "clean-approve",
    ...overrides,
  };
}

function fakes({ requirements = ["Route uses verifyJWT middleware"], findings }) {
  const llmClient = vi
    .fn()
    // Node 4 (requirements decomposition)
    .mockResolvedValueOnce({ content: { requirements }, tokensUsed: 100 })
    // Node 8 (extract evidence)
    .mockResolvedValueOnce({ content: { findings }, tokensUsed: 150 });
  // Node 11 (critique) reuses llmClient too when there are unmet findings —
  // give it a harmless fallback so tests don't need a third mock value.
  llmClient.mockResolvedValue({ content: { critique: "n/a" }, tokensUsed: 0 });

  return {
    llmClient,
    getInstallationToken: vi.fn(async () => "tok"),
    fetchCompareDiffImpl: vi.fn(
      async () => "diff --git a/src/routes.js b/src/routes.js\n+router.use(verifyJWT)\n",
    ),
    searchCodeImpl: vi.fn(async () => []),
    fetchFileContentImpl: vi.fn(async ({ path }) => ({
      content: path === "src/routes.js" ? "router.use(verifyJWT)" : "",
      sha: "filesha",
    })),
  };
}

describe("evaluateWithRealPipeline", () => {
  it("predicts APPROVED when every requirement is met with a verified citation", async () => {
    const overrides = fakes({
      findings: [
        {
          requirementId: "eval-req-0",
          status: "met",
          citations: [{ path: "src/routes.js", startLine: 1, endLine: 1, symbol: "verifyJWT" }],
          rationale: "found it",
        },
      ],
    });

    const result = await evaluateWithRealPipeline(evalCase(), overrides);

    expect(result.predicted).toBe("APPROVED");
    expect(result.citations).toEqual([{ verified: true }]);
    expect(result.label).toBe("should_approve");
    expect(result.bucket).toBe("clean-approve");
  });

  it("predicts REJECTED when a requirement's citation doesn't verify", async () => {
    const overrides = fakes({
      findings: [
        {
          requirementId: "eval-req-0",
          status: "met",
          citations: [{ path: "src/routes.js", startLine: 1, endLine: 1, symbol: "notThere" }],
          rationale: "claims it, but the symbol isn't in the cited span",
        },
      ],
    });

    const result = await evaluateWithRealPipeline(
      evalCase({ id: "eval-test-2", label: "should_reject", bucket: "clean-reject" }),
      overrides,
    );

    expect(result.predicted).toBe("REJECTED");
    expect(result.citations).toEqual([{ verified: false }]);
  });

  it("fails open (PASSED_BY_SYSTEM_ERROR) instead of throwing when the requirements LLM call fails", async () => {
    const llmClient = vi.fn().mockRejectedValue(new Error("no API key"));

    const result = await evaluateWithRealPipeline(evalCase(), { llmClient });

    expect(result.predicted).toBe("PASSED_BY_SYSTEM_ERROR");
    expect(result.errorCode).toBe("LLM_TIMEOUT");
  });
});
