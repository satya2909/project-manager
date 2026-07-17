// Node 6 — searchRepo (deterministic, no LLM). This is why the system beats
// a diff-only evaluator: a diff shows what changed, not what exists
// (plans/PRD_v2.md §7.2 Node 6). Candidates union three sources — diff
// paths, code search on requirement-derived terms, and a small structural
// heuristic — capped at 20.
//
// GitHub's Code Search API rate-limits hard (~10-30 req/min,
// plans/ai-dod-plan.md §4.1 4d). A failure here degrades to diff+heuristic
// candidates only — `searchDegraded: true` is the distinct signal so a
// silent accuracy regression on "existing infra" cases doesn't look like a
// normal outage.

import { searchCode as defaultSearchCodeImpl } from "../github/search.js";
import { extractSearchTerms } from "../github/search-terms.js";
import { getRepoAndToken } from "../github/installation-auth.js";

const MAX_CANDIDATES = 20;
const HEURISTIC_PATHS = ["package.json"];

export async function searchRepo(
  state,
  { getInstallationToken, searchCodeImpl = defaultSearchCodeImpl } = {},
) {
  const candidates = new Map(); // path -> reason, insertion order = priority

  for (const file of state.diff.files) {
    if (!candidates.has(file.path)) candidates.set(file.path, "diff");
  }

  for (const path of HEURISTIC_PATHS) {
    if (!candidates.has(path)) candidates.set(path, "heuristic");
  }

  const terms = extractSearchTerms(state.requirements);
  state.searchDegraded = false;

  if (terms.length > 0) {
    try {
      const { owner, repo, token } = await getRepoAndToken(state, { getInstallationToken });

      for (const term of terms) {
        const paths = await searchCodeImpl({ owner, repo, term, token });
        for (const path of paths) {
          if (!candidates.has(path)) candidates.set(path, "search");
        }
      }
    } catch (err) {
      state.errors.push({ node: "searchRepo", message: err.message });
      state.searchDegraded = true;
    }
  }

  state.candidates = Array.from(candidates.entries())
    .slice(0, MAX_CANDIDATES)
    .map(([path, reason]) => ({ path, reason }));

  return state;
}
