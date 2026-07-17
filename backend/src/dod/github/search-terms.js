// Deterministic term extraction for Node 6's code search (plans/PRD_v2.md
// §7.2 Node 6) — "terms derived deterministically from the persisted
// requirements (stable across runs because the requirements are stable)".
// Order and content must be identical across runs on the same requirements
// so candidate selection doesn't drift.

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "on", "in", "to", "of", "and", "for",
  "with", "that", "this", "be", "it", "as", "by", "from", "when", "must",
  "should", "will", "has", "have", "not",
]);

const MIN_TERM_LENGTH = 4;
const DEFAULT_MAX_TERMS = 8;

export function extractSearchTerms(requirements, { maxTerms = DEFAULT_MAX_TERMS } = {}) {
  const seen = new Set();
  const terms = [];

  for (const requirement of requirements) {
    const words = requirement.text.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? [];
    for (const word of words) {
      const lower = word.toLowerCase();
      if (lower.length < MIN_TERM_LENGTH) continue;
      if (STOPWORDS.has(lower)) continue;
      if (seen.has(lower)) continue;

      seen.add(lower);
      terms.push(word);
      if (terms.length >= maxTerms) return terms;
    }
  }

  return terms;
}
