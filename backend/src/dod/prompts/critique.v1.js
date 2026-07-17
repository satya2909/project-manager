// Critique prompt (Node 11, plans/PRD_v2.md §7.2 Node 11). Optional, cheap —
// turns unmet findings into prose feedback for the developer. No separate
// "Report Agent"; a node whose entire job is string formatting isn't one.

const SYSTEM = `You write a short, direct piece of feedback for a developer about which requirements of a task are not yet evidenced in their pull request.

Rules:
- Be concise: a few sentences, not a report.
- Reference only the unmet requirements given to you — do not invent new ones.
- Do not mention percentages or scores.
- Respond with ONLY a JSON object of the shape {"critique": "..."}. No prose, no markdown fences.`;

export function buildCritiquePrompt({ requirements, findings }) {
  const byId = new Map(requirements.map((r) => [String(r.id), r.text]));
  const unmetLines = findings
    .filter((f) => f.status !== "met")
    .map((f) => `- ${byId.get(String(f.requirementId)) ?? f.requirementId}: ${f.rationale ?? "not evidenced"}`)
    .join("\n");

  const user = `Unmet requirements:\n${unmetLines}`;

  return {
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  };
}
