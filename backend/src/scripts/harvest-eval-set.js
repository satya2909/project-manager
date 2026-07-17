// backend/src/scripts/harvest-eval-set.js
//
// Phase 0.1 (plans/ai-dod-plan.md) — harvest labeling *candidates* from this
// repo's own git history: one file per commit-with-a-single-parent, using the
// commit as a stand-in (task description, headSha, baseSha) pair.
//
// This produces UNLABELED candidates only. Labeling 50 of them by hand into
// backend/eval/dod-set.json is the actual work (see ai-dod-plan.md §0.1) —
// this script does not and cannot do that part.
//
// Usage: node backend/src/scripts/harvest-eval-set.js > backend/eval/candidates.json

import { execSync } from "child_process";
import { fileURLToPath } from "url";

const LOG_FORMAT = "%H|%P|%s";

export function parseCommitsToCandidates(lines) {
  const candidates = [];
  for (const line of lines) {
    if (!line) continue;
    const [headSha, parents, ...rest] = line.split("|");
    const title = rest.join("|");
    const parentList = parents.trim().split(/\s+/).filter(Boolean);

    // Skip merge commits (no single base to diff against) and the root
    // commit (no parent at all, nothing to compare).
    if (parentList.length !== 1) continue;

    candidates.push({
      id: `eval-${String(candidates.length + 1).padStart(3, "0")}`,
      task: { title, description: "" },
      headSha,
      baseSha: parentList[0],
      prNumber: null,
      label: null,
      bucket: null,
      missingRequirements: [],
      notes: "",
    });
  }
  return candidates;
}

function harvest() {
  const output = execSync(`git log --format="${LOG_FORMAT}"`, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  const lines = output.split("\n").filter(Boolean);
  return parseCommitsToCandidates(lines);
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const candidates = harvest();
  console.log(JSON.stringify(candidates, null, 2));
  console.error(
    `\n✓ Harvested ${candidates.length} unlabeled candidates. ` +
      `Hand-label 50 of them (per plans/ai-dod-plan.md §0.1's bucket targets) ` +
      `into backend/eval/dod-set.json — this step is not automatable.`,
  );
}
