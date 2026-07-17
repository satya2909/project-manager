// Node 9 — verifyCitations (deterministic — the trust anchor). For each
// citation, re-reads the file already fetched at the pinned sha and
// mechanically confirms the claimed span exists and contains the symbol
// (plans/PRD_v2.md §7.2 Node 9). Kills hallucination, blunts prompt
// injection (a claim needs real code, not just a claim), and makes every
// green check link to something a user can verify themselves.
//
// The containment check MUST be word-boundary aware, not plain substring
// matching — `span.includes('auth')` would false-positive against
// `authenticate`, `unauthorized`, `authError` (fixed 2026-07-17,
// /plan-ceo-review — see ai-dod-plan.md §4.1 4e).

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryIncludes(text, symbol) {
  return new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(text);
}

export async function verifyCitations(state) {
  for (const finding of state.findings) {
    for (const citation of finding.citations) {
      const file = state.files.find((f) => f.path === citation.path);
      if (!file) {
        citation.verified = false;
        continue;
      }
      const lines = file.content.split("\n");
      const span = lines.slice(citation.startLine - 1, citation.endLine).join("\n");
      citation.verified = wordBoundaryIncludes(span, citation.symbol);
    }

    if (finding.status === "met") {
      const anyVerified = finding.citations.some((c) => c.verified);
      if (!anyVerified) finding.status = "unverified";
    }
  }

  return state;
}
