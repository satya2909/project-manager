// backend/src/utils/task-key-parser.js
//
// Phase 3.2 (plans/ai-dod-plan.md) — pure task-key parsing. Precedence:
// PR title -> branch -> PR body (plans/PRD_v2.md §6.2).
//
// The prefix must match the resolved project's keyPrefix OR one of its
// prefixAliases, case-insensitively. A mismatch is a MISS, never a
// cross-project lookup — the prefix is a typo guard against something like
// `feature/JIRA-500-x` landing in the wrong project, not a router (the
// project is always already resolved via the 1:1 repo binding before this
// parser ever runs — see PRD §6.1).

const BRANCH_RE = /\b([A-Z]{2,6})-(\d+)\b/i;
const PR_TITLE_RE = /\[([A-Z]{2,6})-(\d+)\]/i;
const PR_BODY_RE = /\b(?:closes|fixes|resolves)\s+([A-Z]{2,6})-(\d+)\b/i;

function validPrefixes(project) {
  return new Set(
    [project.keyPrefix, ...(project.prefixAliases ?? [])].map((p) =>
      p.toUpperCase(),
    ),
  );
}

function tryMatch(text, regex, prefixes) {
  if (!text) return null;
  const match = text.match(regex);
  if (!match) return null;
  const [, prefix, number] = match;
  if (!prefixes.has(prefix.toUpperCase())) return null;
  return Number(number);
}

export function parseTaskKey({ branch, prTitle, prBody } = {}, project) {
  const prefixes = validPrefixes(project);

  const fromTitle = tryMatch(prTitle, PR_TITLE_RE, prefixes);
  if (fromTitle !== null) return { taskNumber: fromTitle, source: "pr_title" };

  const fromBranch = tryMatch(branch, BRANCH_RE, prefixes);
  if (fromBranch !== null) return { taskNumber: fromBranch, source: "branch" };

  const fromBody = tryMatch(prBody, PR_BODY_RE, prefixes);
  if (fromBody !== null) return { taskNumber: fromBody, source: "pr_body" };

  return null;
}
