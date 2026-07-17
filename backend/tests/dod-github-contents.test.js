import { describe, it, expect, vi } from "vitest";
import { fetchFileContent } from "../src/dod/github/contents.js";

function base64(s) {
  return Buffer.from(s, "utf8").toString("base64");
}

describe("fetchFileContent", () => {
  it("fetches at the pinned ref and decodes base64 content", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: base64("console.log('hi')"), encoding: "base64", sha: "filesha" }),
    }));

    const result = await fetchFileContent({
      owner: "acme",
      repo: "camp",
      path: "src/index.js",
      ref: "headsha1",
      token: "tok",
      fetchImpl,
    });

    expect(result.content).toBe("console.log('hi')");
    expect(result.sha).toBe("filesha");
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/acme/camp/contents/src/index.js?ref=headsha1");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });

  it("returns null when the file is missing (404)", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, text: async () => "not found" }));

    const result = await fetchFileContent({
      owner: "acme",
      repo: "camp",
      path: "missing.js",
      ref: "headsha1",
      token: "tok",
      fetchImpl,
    });

    expect(result).toBeNull();
  });

  it("throws on a non-404 error", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, text: async () => "server error" }));

    await expect(
      fetchFileContent({ owner: "acme", repo: "camp", path: "x.js", ref: "sha", token: "tok", fetchImpl }),
    ).rejects.toThrow(/500/);
  });
});
