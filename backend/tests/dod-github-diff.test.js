import { describe, it, expect, vi } from "vitest";
import { fetchPullRequestDiff } from "../src/dod/github/diff.js";

describe("fetchPullRequestDiff", () => {
  it("requests the unified diff media type for the given PR", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, text: async () => "diff --git a/x b/x\n" }));

    const text = await fetchPullRequestDiff({
      owner: "acme",
      repo: "camp",
      prNumber: 42,
      token: "tok",
      fetchImpl,
    });

    expect(text).toBe("diff --git a/x b/x\n");
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/camp/pulls/42");
    expect(options.headers.Authorization).toBe("Bearer tok");
    expect(options.headers.Accept).toBe("application/vnd.github.v3.diff");
  });

  it("throws with status and body on a non-ok response", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, text: async () => "not found" }));

    await expect(
      fetchPullRequestDiff({ owner: "acme", repo: "camp", prNumber: 42, token: "tok", fetchImpl }),
    ).rejects.toThrow(/404/);
  });
});
