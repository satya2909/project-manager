// Prompt injection defense #3 (plans/PRD_v2.md §7.5): regex scan of the diff
// for review-directed instruction patterns. Hits do NOT block — they're
// recorded on the log and surfaced to project admins. A dev writing a
// legitimate comment about the AI shouldn't be punished; a dev doing it
// inside a PR that flipped to APPROVED should be visible.

const PATTERNS = [
  /respond\s+APPROVED/i,
  /ignore\s+(all\s+|the\s+)?previous\s+instructions/i,
  /^\s*system\s*:/im,
  /^\s*assistant\s*:/im,
];

export function detectInjectionPatterns(text) {
  return PATTERNS.some((rx) => rx.test(text));
}
