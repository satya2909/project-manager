import { describe, it, expect, vi } from "vitest";
import { searchCode } from "../src/dod/github/search.js";

describe("searchCode", () => {
  it("queries GitHub code search scoped to the repo and returns matched paths", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [{ path: "src/middlewares/auth.middlewares.js" }, { path: "src/index.js" }] }),
    }));

    const paths = await searchCode({ owner: "acme", repo: "camp", term: "verifyJWT", token: "tok", fetchImpl });

    expect(paths).toEqual(["src/middlewares/auth.middlewares.js", "src/index.js"]);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toContain("q=verifyJWT%20repo%3Aacme%2Fcamp");
    expect(options.headers.Authorization).toBe("Bearer tok");
  });

  it("throws on a rate-limited (403) response so the caller can flag searchDegraded", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 403, text: async () => "rate limited" }));

    await expect(
      searchCode({ owner: "acme", repo: "camp", term: "x", token: "tok", fetchImpl }),
    ).rejects.toThrow(/403/);
  });
});
