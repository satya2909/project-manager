// Resolves a branch name to its current commit SHA. Used only by the
// POST /ai-evaluate controller (plans/PRD_v2.md §5.6 "Verify now" path) to
// pin a HEAD sha before enqueueing — every pipeline node after that reads
// the pipeline's `pinnedSha`, never a mutable ref, so this resolution has to
// happen once, up front, same as the webhook path pins `pull_request.head.sha`.

const GITHUB_API_BASE = "https://api.github.com";

export async function getRefSha({ owner, repo, ref, token, fetchImpl = fetch }) {
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.sha",
      },
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ref lookup failed (${res.status}): ${body}`);
  }

  return (await res.text()).trim();
}
