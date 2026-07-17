import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { verifyCitations } from "../src/dod/nodes/09-verify-citations.js";
import { createRunState } from "../src/dod/state.js";

function state({ files, findings }) {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { headSha: "sha1" },
  });
  s.files = files;
  s.findings = findings;
  return s;
}

describe("verifyCitations (Node 9) — the trust anchor", () => {
  it("verifies a citation whose span genuinely contains the symbol", async () => {
    const s = state({
      files: [{ path: "src/routes.js", content: "line1\nrouter.use(verifyJWT)\nline3" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          citations: [{ path: "src/routes.js", startLine: 2, endLine: 2, symbol: "verifyJWT" }],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].citations[0].verified).toBe(true);
    expect(result.findings[0].status).toBe("met");
  });

  it("does NOT false-positive on a substring match (auth vs authenticate) — word-boundary aware", async () => {
    const s = state({
      files: [{ path: "src/auth.js", content: "function authenticate() { return unauthorized(); }" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          citations: [{ path: "src/auth.js", startLine: 1, endLine: 1, symbol: "auth" }],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].citations[0].verified).toBe(false);
    // all citations failed verification -> downgrade to 'unverified', doesn't count as met
    expect(result.findings[0].status).toBe("unverified");
  });

  it("marks a citation unverified when the cited path was never fetched (hallucinated file)", async () => {
    const s = state({
      files: [{ path: "src/real.js", content: "const x = verifyJWT" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          citations: [{ path: "src/invented.js", startLine: 1, endLine: 1, symbol: "verifyToken" }],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].citations[0].verified).toBe(false);
    expect(result.findings[0].status).toBe("unverified");
  });

  it("keeps 'met' when at least one of several citations verifies, even if another doesn't", async () => {
    const s = state({
      files: [{ path: "src/a.js", content: "verifyJWT()" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          citations: [
            { path: "src/missing.js", startLine: 1, endLine: 1, symbol: "x" },
            { path: "src/a.js", startLine: 1, endLine: 1, symbol: "verifyJWT" },
          ],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].status).toBe("met");
    expect(result.findings[0].citations[0].verified).toBe(false);
    expect(result.findings[0].citations[1].verified).toBe(true);
  });

  it("leaves 'unmet' findings alone (no citations to verify, status untouched)", async () => {
    const s = state({
      files: [],
      findings: [{ requirementId: "req1", status: "unmet", citations: [], rationale: "not found" }],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].status).toBe("unmet");
  });

  it("handles a symbol containing regex-special characters safely, without throwing", async () => {
    const s = state({
      files: [{ path: "src/a.js", content: "return user.id;" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          citations: [{ path: "src/a.js", startLine: 1, endLine: 1, symbol: "user.id" }],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].citations[0].verified).toBe(true);
  });

  it("does not verify when the cited line range doesn't actually include the symbol (off-by-one)", async () => {
    const s = state({
      files: [{ path: "src/a.js", content: "line1\nline2\nverifyJWT()\nline4" }],
      findings: [
        {
          requirementId: "req1",
          status: "met",
          // symbol is on line 3, but citation claims lines 1-2
          citations: [{ path: "src/a.js", startLine: 1, endLine: 2, symbol: "verifyJWT" }],
        },
      ],
    });

    const result = await verifyCitations(s);
    expect(result.findings[0].citations[0].verified).toBe(false);
    expect(result.findings[0].status).toBe("unverified");
  });
});
