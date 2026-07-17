import { describe, it, expect, vi } from "vitest";
import mongoose from "mongoose";
import { readFiles } from "../src/dod/nodes/07-read-files.js";
import { createRunState } from "../src/dod/state.js";

function state(candidates) {
  const s = createRunState({
    runId: "run1",
    trigger: "pull_request",
    organizationId: new mongoose.Types.ObjectId(),
    projectId: new mongoose.Types.ObjectId(),
    taskId: new mongoose.Types.ObjectId(),
    evaluationSeq: 1,
    repo: { fullName: "acme/camp", installationId: 999, headSha: "sha1" },
  });
  s.pinnedSha = "sha1";
  s.candidates = candidates;
  return s;
}

describe("readFiles (Node 7)", () => {
  it("fetches content for each candidate at the pinned sha", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchFileContentImpl = vi.fn(async ({ path }) => ({ content: `content of ${path}`, sha: "filesha" }));

    const s = await readFiles(state([{ path: "src/a.js" }, { path: "src/b.js" }]), {
      getInstallationToken,
      fetchFileContentImpl,
    });

    expect(s.files).toHaveLength(2);
    expect(s.files[0]).toEqual({ path: "src/a.js", content: "content of src/a.js", sha: "filesha" });
    expect(fetchFileContentImpl).toHaveBeenCalledWith(
      expect.objectContaining({ owner: "acme", repo: "camp", ref: "sha1", token: "tok" }),
    );
  });

  it("skips candidates that 404 (fetchFileContentImpl resolves null)", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchFileContentImpl = vi.fn(async ({ path }) =>
      path === "missing.js" ? null : { content: "x", sha: "s" },
    );

    const s = await readFiles(state([{ path: "missing.js" }, { path: "present.js" }]), {
      getInstallationToken,
      fetchFileContentImpl,
    });

    expect(s.files).toHaveLength(1);
    expect(s.files[0].path).toBe("present.js");
  });

  it("caps at 20 files even with more candidates", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchFileContentImpl = vi.fn(async ({ path }) => ({ content: "x", sha: "s" }));
    const candidates = Array.from({ length: 25 }, (_, i) => ({ path: `f${i}.js` }));

    const s = await readFiles(state(candidates), { getInstallationToken, fetchFileContentImpl });

    expect(s.files).toHaveLength(20);
  });

  it("skips a file over 80KB", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const bigContent = "x".repeat(90 * 1024);
    const fetchFileContentImpl = vi.fn(async ({ path }) =>
      path === "big.js" ? { content: bigContent, sha: "s" } : { content: "small", sha: "s2" },
    );

    const s = await readFiles(state([{ path: "big.js" }, { path: "small.js" }]), {
      getInstallationToken,
      fetchFileContentImpl,
    });

    expect(s.files.map((f) => f.path)).toEqual(["small.js"]);
  });

  it("stops adding files once the 400KB total cap is reached", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const chunk = "x".repeat(150 * 1024); // 3 of these exceed 400KB total
    const fetchFileContentImpl = vi.fn(async () => ({ content: chunk, sha: "s" }));
    const candidates = [{ path: "a.js" }, { path: "b.js" }, { path: "c.js" }, { path: "d.js" }];

    const s = await readFiles(state(candidates), { getInstallationToken, fetchFileContentImpl });

    expect(s.files.length).toBeLessThan(4);
  });

  it("skips (does not fail the run) when an individual file fetch throws", async () => {
    const getInstallationToken = vi.fn(async () => "tok");
    const fetchFileContentImpl = vi.fn(async ({ path }) => {
      if (path === "broken.js") throw new Error("network blip");
      return { content: "ok", sha: "s" };
    });

    const s = await readFiles(state([{ path: "broken.js" }, { path: "fine.js" }]), {
      getInstallationToken,
      fetchFileContentImpl,
    });

    expect(s.exit).toBeNull();
    expect(s.files.map((f) => f.path)).toEqual(["fine.js"]);
  });
});
