// Node 7 — readFiles (deterministic). Fetches candidate contents at the
// pinned sha. Caps: 20 files, 80KB each, 400KB total (plans/PRD_v2.md §7.2
// Node 7). A single candidate's fetch failing (404, network blip) is a
// normal outcome — search/heuristics guess at paths that may not exist —
// so it's skipped, not fatal to the run.

import { fetchFileContent as defaultFetchFileContentImpl } from "../github/contents.js";
import { getRepoAndToken } from "../github/installation-auth.js";

const MAX_FILES = 20;
const MAX_FILE_BYTES = 80 * 1024;
const MAX_TOTAL_BYTES = 400 * 1024;

export async function readFiles(
  state,
  { getInstallationToken, fetchFileContentImpl = defaultFetchFileContentImpl } = {},
) {
  const ref = state.pinnedSha ?? state.repo.headSha;
  const { owner, repo, token } = await getRepoAndToken(state, { getInstallationToken });

  const files = [];
  let totalBytes = 0;

  for (const candidate of state.candidates.slice(0, MAX_FILES)) {
    let result;
    try {
      result = await fetchFileContentImpl({ owner, repo, path: candidate.path, ref, token });
    } catch (err) {
      state.errors.push({ node: "readFiles", path: candidate.path, message: err.message });
      continue;
    }

    if (!result) continue; // 404 — a guessed candidate path that doesn't exist

    const size = Buffer.byteLength(result.content, "utf8");
    if (size > MAX_FILE_BYTES) continue;
    if (totalBytes + size > MAX_TOTAL_BYTES) continue;

    files.push({ path: candidate.path, content: result.content, sha: result.sha });
    totalBytes += size;
  }

  state.files = files;
  return state;
}
