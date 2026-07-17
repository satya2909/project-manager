import { describe, it, expect } from "vitest";
import { stripDiff } from "../src/dod/github/diff-stripper.js";

function fileDiff(path, bodyLines = ["+added line"], size) {
  const header = `diff --git a/${path} b/${path}\nindex 111..222 100644\n--- a/${path}\n+++ b/${path}\n@@ -1,1 +1,${bodyLines.length} @@\n`;
  const body = bodyLines.join("\n") + "\n";
  const text = header + body;
  if (size) {
    return text + "x".repeat(Math.max(0, size - Buffer.byteLength(text, "utf8") - 1)) + "\n";
  }
  return text;
}

function binaryFileDiff(path) {
  return `diff --git a/${path} b/${path}\nindex 111..222 100644\nBinary files a/${path} and b/${path} differ\n`;
}

describe("stripDiff", () => {
  it("keeps ordinary source file diffs untouched", () => {
    const diff = fileDiff("src/index.js");
    const result = stripDiff(diff);

    expect(result.strippedPaths).toEqual([]);
    expect(result.files).toEqual([{ path: "src/index.js" }]);
    expect(result.truncated).toBe(false);
    expect(result.text).toContain("added line");
  });

  it("strips lockfiles (package-lock.json, yarn.lock, pnpm-lock.yaml, *.lock)", () => {
    const diff = [
      fileDiff("package-lock.json"),
      fileDiff("yarn.lock"),
      fileDiff("pnpm-lock.yaml"),
      fileDiff("Cargo.lock"),
      fileDiff("src/index.js"),
    ].join("");

    const result = stripDiff(diff);

    expect(result.strippedPaths.sort()).toEqual(
      ["Cargo.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock"].sort(),
    );
    expect(result.files).toEqual([{ path: "src/index.js" }]);
  });

  it("strips vendored/build directories", () => {
    const diff = [
      fileDiff("dist/bundle.js"),
      fileDiff("build/out.js"),
      fileDiff("node_modules/lib/index.js"),
      fileDiff("vendor/thing.js"),
      fileDiff("coverage/report.html"),
      fileDiff(".next/static/chunk.js"),
      fileDiff("src/real.js"),
    ].join("");

    const result = stripDiff(diff);

    expect(result.files).toEqual([{ path: "src/real.js" }]);
    expect(result.strippedPaths).toHaveLength(6);
  });

  it("strips binary files (marked 'Binary files differ' and denylisted extensions)", () => {
    const diff = [binaryFileDiff("assets/logo.png"), fileDiff("assets/icon.ico"), fileDiff("src/real.js")].join("");
    const result = stripDiff(diff);

    expect(result.files).toEqual([{ path: "src/real.js" }]);
    expect(result.strippedPaths.sort()).toEqual(["assets/icon.ico", "assets/logo.png"].sort());
  });

  it("strips generated files (*.snap, *.min.js, *.map) and large *.svg (>50KB)", () => {
    const diff = [
      fileDiff("__snapshots__/a.snap"),
      fileDiff("dist/app.min.js"),
      fileDiff("dist/app.js.map"),
      fileDiff("assets/big.svg", ["+data"], 60 * 1024),
      fileDiff("assets/small.svg"),
      fileDiff("src/real.js"),
    ].join("");

    const result = stripDiff(diff);

    const keptPaths = result.files.map((f) => f.path);
    expect(keptPaths).toContain("src/real.js");
    expect(keptPaths).toContain("assets/small.svg");
    expect(keptPaths).not.toContain("assets/big.svg");
    expect(result.strippedPaths).toContain("__snapshots__/a.snap");
    expect(result.strippedPaths).toContain("dist/app.min.js");
    expect(result.strippedPaths).toContain("dist/app.js.map");
    expect(result.strippedPaths).toContain("assets/big.svg");
  });

  it("caps total diff text at 120KB, truncating by whole file, largest first, and records truncated:true", () => {
    const diff = [
      fileDiff("src/huge.js", ["+x"], 100 * 1024),
      fileDiff("src/medium.js", ["+x"], 40 * 1024),
      fileDiff("src/small.js"),
    ].join("");

    const result = stripDiff(diff, { maxBytes: 120 * 1024 });

    expect(result.truncated).toBe(true);
    // The largest file should be dropped first to get under the cap.
    expect(result.strippedPaths).toContain("src/huge.js");
    const keptPaths = result.files.map((f) => f.path);
    expect(keptPaths).toContain("src/small.js");
  });

  it("does not truncate when total diff text is already under the cap", () => {
    const diff = fileDiff("src/small.js");
    const result = stripDiff(diff, { maxBytes: 120 * 1024 });

    expect(result.truncated).toBe(false);
    expect(result.strippedPaths).toEqual([]);
  });
});
