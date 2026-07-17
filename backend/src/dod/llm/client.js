// backend/src/dod/llm/client.js
//
// Thin wrapper around Anthropic's Messages API — plain fetch, no SDK, same
// injectable-`fetchImpl` convention as github-app.service.js. Handles retry,
// timeout, and JSON-schema enforcement so every LLM node (4, 8, 11) gets the
// same fail-open contract: throw after retries are exhausted, and let the
// caller decide what "fail open" means for that node
// (plans/PRD_v2.md §7.3, §7.5).

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function extractText(body) {
  return (body.content ?? [])
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
}

function parseJson(text) {
  // Models sometimes wrap JSON in a fenced code block despite instructions —
  // strip that before parsing rather than failing on cosmetic formatting.
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
  return JSON.parse(stripped);
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM call timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function callLlm({
  system,
  messages,
  temperature = 0,
  maxTokens = 4096,
  apiKey = process.env.ANTHROPIC_API_KEY,
  model = process.env.DOD_LLM_MODEL || "claude-sonnet-4-6",
  fetchImpl = fetch,
  timeoutMs = 45_000,
  maxRetries = 2,
}) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const res = await withTimeout(
        fetchImpl(ANTHROPIC_API_BASE, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": ANTHROPIC_VERSION,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            system,
            messages,
            temperature,
            max_tokens: maxTokens,
          }),
        }),
        timeoutMs,
      );

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`LLM call failed (${res.status}): ${body}`);
      }

      const body = await res.json();
      const text = extractText(body);
      const content = parseJson(text); // throws on unparsable output

      return {
        content,
        tokensUsed: (body.usage?.input_tokens ?? 0) + (body.usage?.output_tokens ?? 0),
        model,
      };
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(`LLM call failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}
