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
