// backend/src/dod/github/diff-stripper.js
//
// Node 5's stripping pass (plans/PRD_v2.md §7.2 Node 5). Pure function —
// everything stripped is recorded in `strippedPaths` and shown in the UI, so
// a user staring at a bad verdict can see their 4MB migration file never
// reached the model.

const LOCKFILE_PATTERNS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)yarn\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /\.lock$/,
];

const VENDORED_DIR_PATTERNS = [
  /(^|\/)dist\//,
  /(^|\/)build\//,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /(^|\/)coverage\//,
  /(^|\/)\.next\//,
];

const BINARY_EXT_DENYLIST = /\.(png|jpe?g|gif|ico|pdf|zip|tar|gz|woff2?|ttf|eot|mp4|mov|webp|bmp)$/i;

const GENERATED_PATTERNS = [/\.snap$/, /\.min\.js$/, /\.map$/];
const SVG_SIZE_LIMIT_BYTES = 50 * 1024;
const DEFAULT_MAX_BYTES = 120 * 1024;

function splitDiffIntoFiles(diffText) {
  const chunks = diffText.split(/(?=^diff --git )/m).filter((c) => c.trim().length > 0);

  return chunks.map((chunk) => {
    const match = chunk.match(/^diff --git a\/(.+?) b\/(.+?)\r?\n/);
    const path = match ? match[2] : null;
    const isBinaryMarker = /^Binary files .* differ/m.test(chunk);
    return { path, text: chunk, isBinaryMarker, size: Buffer.byteLength(chunk, "utf8") };
  });
}

function shouldStripByPattern(path, file) {
  if (LOCKFILE_PATTERNS.some((rx) => rx.test(path))) return true;
  if (VENDORED_DIR_PATTERNS.some((rx) => rx.test(path))) return true;
  if (file.isBinaryMarker || BINARY_EXT_DENYLIST.test(path)) return true;
  if (GENERATED_PATTERNS.some((rx) => rx.test(path))) return true;
  if (/\.svg$/i.test(path) && file.size > SVG_SIZE_LIMIT_BYTES) return true;
  return false;
}

export function stripDiff(diffText, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
  const allFiles = splitDiffIntoFiles(diffText);
  const strippedPaths = [];
  let kept = [];

  for (const file of allFiles) {
    const path = file.path ?? "(unknown)";
    if (shouldStripByPattern(path, file)) {
      strippedPaths.push(path);
      continue;
    }
    kept.push(file);
  }

  let truncated = false;
  const totalBytes = kept.reduce((sum, f) => sum + f.size, 0);

  if (totalBytes > maxBytes) {
    truncated = true;
    const largestFirst = [...kept].sort((a, b) => b.size - a.size);
    const droppedPaths = new Set();
    let remainingBytes = totalBytes;

    for (const file of largestFirst) {
      if (remainingBytes <= maxBytes) break;
      droppedPaths.add(file.path);
      remainingBytes -= file.size;
    }

    strippedPaths.push(...droppedPaths);
    kept = kept.filter((f) => !droppedPaths.has(f.path));
  }

  return {
    text: kept.map((f) => f.text).join(""),
    files: kept.map((f) => ({ path: f.path })),
    strippedPaths,
    truncated,
  };
}
