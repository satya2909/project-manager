import { describe, it, expect, vi, afterEach } from "vitest";
import { generateKeyPairSync } from "crypto";
import jwt from "jsonwebtoken";
import {
  signAppJwt,
  getInstallationToken,
  listInstallationRepositories,
} from "../src/services/github-app.service.js";
import { createInMemoryTokenCache } from "../src/services/token-cache.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

describe("signAppJwt", () => {
  it("signs a JWT verifiable with the app's public key, iss = appId", () => {
    const token = signAppJwt({ appId: "12345", privateKey });
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    expect(decoded.iss).toBe("12345");
  });

  it("sets iat ~60s in the past (clock drift tolerance) and expiry <= 10 minutes out", () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signAppJwt({ appId: "12345", privateKey });
    const decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    expect(decoded.iat).toBeLessThanOrEqual(now - 55);
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(600);
  });
});

describe("getInstallationToken", () => {
  afterEach(() => vi.restoreAllMocks());

  it("mints a fresh token and caches it on first call", async () => {
    const cache = createInMemoryTokenCache();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ token: "ghs_minted", expires_at: new Date(Date.now() + 3600_000).toISOString() }),
    });

    const token = await getInstallationToken({
      installationId: 999,
      cache,
      appId: "12345",
      privateKey,
      fetchImpl,
    });

    expect(token).toBe("ghs_minted");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await cache.get("gh:tok:999")).toBe("ghs_minted");
  });

  it("reuses the cached token on a second call — no second mint", async () => {
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:999", "ghs_cached", 60_000);
    const fetchImpl = vi.fn();

    const token = await getInstallationToken({
      installationId: 999,
      cache,
      appId: "12345",
      privateKey,
      fetchImpl,
    });

    expect(token).toBe("ghs_cached");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("busts the cache and retries once on a 401 from a stale cached token", async () => {
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:999", "ghs_stale", 60_000);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ token: "ghs_fresh", expires_at: new Date(Date.now() + 3600_000).toISOString() }),
    });

    const token = await getInstallationToken({
      installationId: 999,
      cache,
      appId: "12345",
      privateKey,
      fetchImpl,
      // Simulates the caller discovering the cached token is stale (a 401
      // from a subsequent GitHub API call using it) by forcing a refetch.
      forceRefresh: true,
    });

    expect(token).toBe("ghs_fresh");
    expect(await cache.get("gh:tok:999")).toBe("ghs_fresh");
  });

  it("throws a clear error when GitHub's mint endpoint fails", async () => {
    const cache = createInMemoryTokenCache();
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Installation not found",
    });

    await expect(
      getInstallationToken({
        installationId: 999,
        cache,
        appId: "12345",
        privateKey,
        fetchImpl,
      }),
    ).rejects.toThrow(/404/);
  });
});

describe("listInstallationRepositories", () => {
  it("mints a token then lists repos, normalized to {fullName, githubId, defaultBranch}", async () => {
    const cache = createInMemoryTokenCache();
    const fetchImpl = vi.fn().mockImplementation((url) => {
      if (url.includes("access_tokens")) {
        return Promise.resolve({
          ok: true,
          status: 201,
          json: async () => ({ token: "ghs_x", expires_at: new Date(Date.now() + 3600_000).toISOString() }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          repositories: [
            { id: 1, full_name: "acme/widgets", default_branch: "main" },
            { id: 2, full_name: "acme/gadgets", default_branch: "trunk" },
          ],
        }),
      });
    });

    const repos = await listInstallationRepositories({
      installationId: 999,
      cache,
      appId: "12345",
      privateKey,
      fetchImpl,
    });

    expect(repos).toEqual([
      { githubId: 1, fullName: "acme/widgets", defaultBranch: "main" },
      { githubId: 2, fullName: "acme/gadgets", defaultBranch: "trunk" },
    ]);
  });

  it("throws a clear error when the repositories call fails", async () => {
    const cache = createInMemoryTokenCache();
    await cache.set("gh:tok:999", "ghs_cached", 60_000);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => "server error",
    });

    await expect(
      listInstallationRepositories({
        installationId: 999,
        cache,
        appId: "12345",
        privateKey,
        fetchImpl,
      }),
    ).rejects.toThrow(/500/);
  });
});
