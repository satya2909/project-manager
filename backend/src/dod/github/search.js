// Node 6's GitHub call (plans/PRD_v2.md §7.2 Node 6). GitHub's Code Search
// API has a much stricter rate limit (~10-30 req/min) than the general REST
// API — a 403/429 here is expected under load, not exceptional. The caller
// (Node 6) catches this and sets `searchDegraded: true` rather than failing
// the run (plans/ai-dod-plan.md §4.1 4d).

const GITHUB_API_BASE = "https://api.github.com";

export async function searchCode({ owner, repo, term, token, fetchImpl = fetch }) {
  const q = encodeURIComponent(`${term} repo:${owner}/${repo}`);
  const res = await fetchImpl(`${GITHUB_API_BASE}/search/code?q=${q}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub code search failed (${res.status}): ${body}`);
  }

  const { items } = await res.json();
  return (items ?? []).map((item) => item.path);
}
