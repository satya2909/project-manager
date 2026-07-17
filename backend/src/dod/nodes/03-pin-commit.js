// Node 3 — pinCommit (deterministic). Every subsequent read (diff, file
// contents, search) is pinned to this one SHA. Without pinning, the diff
// comes from commit A while file reads land on commit C and the findings
// describe a tree that never existed (plans/PRD_v2.md §7.2).

export async function pinCommit(state) {
  if (!state.repo.headSha) {
    state.exit = { status: "PASSED_BY_SYSTEM_ERROR", errorCode: "NO_HEAD_SHA" };
    return state;
  }

  state.pinnedSha = state.repo.headSha;
  return state;
}
