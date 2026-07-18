// Node 5 — fetchDiff (deterministic). Fetches the PR's unified diff, then
// strips it (plans/PRD_v2.md §7.2 Node 5). GitHub 5xx/rate-limit failures
// retry with backoff (3x) then fail open — a GitHub outage must never lock
// a task (§7.3).

import {
  fetchPullRequestDiff as defaultFetchDiffImpl,
  fetchCompareDiff as defaultFetchCompareDiffImpl,
} from "../github/diff.js";
import { stripDiff } from "../github/diff-stripper.js";
import { getRepoAndToken } from "../github/installation-auth.js";

const MAX_ATTEMPTS = 3;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchDiff(
  state,
  {
    getInstallationToken,
    fetchDiffImpl = defaultFetchDiffImpl,
    fetchCompareDiffImpl = defaultFetchCompareDiffImpl,
    delayImpl = delay,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const { owner, repo, token } = await getRepoAndToken(state, { getInstallationToken });

      // No PR (e.g. the "Verify now" manual path against a branch pushed
      // straight up, plans/PRD_v2.md §5.6) — diff against the default
      // branch instead of a pull request.
      const rawDiff = state.repo.prNumber
        ? await fetchDiffImpl({
            owner,
            repo,
            prNumber: state.repo.prNumber,
            token,
          })
        : await fetchCompareDiffImpl({
            owner,
            repo,
            base: state.repo.baseSha,
            head: state.pinnedSha,
            token,
          });

      state.diff = stripDiff(rawDiff);
      return state;
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) await delayImpl(attempt * 1000);
    }
  }

  state.errors.push({ node: "fetchDiff", message: lastError?.message });
  state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "GITHUB_UNAVAILABLE" };
  return state;
}
