// Node 5's GitHub call (plans/PRD_v2.md §7.2 Node 5). Plain fetch, same
// injectable-`fetchImpl` convention as github-app.service.js.

const GITHUB_API_BASE = "https://api.github.com";

export async function fetchPullRequestDiff({ owner, repo, prNumber, token, fetchImpl = fetch }) {
  const res = await fetchImpl(`${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${prNumber}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3.diff",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub PR diff fetch failed (${res.status}): ${body}`);
  }

  return res.text();
}

// PRD_v2.md §5.6/§8 "Verify now" path — a manual evaluation with no PR
// (pushed straight to a branch, no `pull_request` webhook ever fired) has no
// prNumber to diff against. `base` is a ref name (the project's default
// branch); `head` is the already-pinned commit SHA (state.pinnedSha) so the
// diff boundary matches every other node reading at that same SHA.
export async function fetchCompareDiff({ owner, repo, base, head, token, fetchImpl = fetch }) {
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3.diff",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub compare diff fetch failed (${res.status}): ${body}`);
  }

  return res.text();
}
