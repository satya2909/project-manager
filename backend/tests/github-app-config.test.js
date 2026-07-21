import { describe, it, expect, afterEach } from "vitest";
import { getGithubAppConfig } from "../src/services/github-app-config.js";

const ORIGINAL_KEY = process.env.GITHUB_APP_PRIVATE_KEY;

describe("getGithubAppConfig", () => {
  afterEach(() => {
    process.env.GITHUB_APP_PRIVATE_KEY = ORIGINAL_KEY;
  });

  it("converts literal \\n escapes (single-line env var editors) into real newlines", () => {
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----\\n";

    const { privateKey } = getGithubAppConfig();

    expect(privateKey).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
    );
  });

  it("leaves an already-multi-line key untouched", () => {
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n";

    const { privateKey } = getGithubAppConfig();

    expect(privateKey).toBe(
      "-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----\n",
    );
  });

  it("passes through an unset key as-is", () => {
    delete process.env.GITHUB_APP_PRIVATE_KEY;

    const { privateKey } = getGithubAppConfig();

    expect(privateKey).toBeUndefined();
  });
});
