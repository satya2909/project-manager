// Node 7's GitHub call (plans/PRD_v2.md §7.2 Node 7). Reads a file's content
// at a pinned ref via the Contents API. A 404 is a normal outcome (a
// candidate path guessed by search/heuristics may not exist) — the caller
// records it and moves on rather than failing the run.

const GITHUB_API_BASE = "https://api.github.com";

export async function fetchFileContent({ owner, repo, path, ref, token, fetchImpl = fetch }) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetchImpl(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
      },
    },
  );

  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub file contents fetch failed (${res.status}): ${body}`);
  }

  const body = await res.json();
  return {
    content: Buffer.from(body.content, body.encoding ?? "base64").toString("utf8"),
    sha: body.sha,
  };
}
