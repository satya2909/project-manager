import { describe, it, expect, vi } from "vitest";
import { callLlm } from "../src/dod/llm/client.js";

function fakeFetch(responses) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return r;
  });
}

function anthropicResponse(text, usage = { input_tokens: 10, output_tokens: 5 }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ content: [{ type: "text", text }], usage }),
  };
}

describe("callLlm", () => {
  it("sends the request with model/system/messages/temperature and parses JSON content", async () => {
    const fetchImpl = fakeFetch([anthropicResponse('{"foo":"bar"}')]);

    const result = await callLlm({
      system: "you are a test",
      messages: [{ role: "user", content: "hi" }],
      temperature: 0,
      apiKey: "test-key",
      model: "claude-test",
      fetchImpl,
      maxRetries: 2,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.model).toBe("claude-test");
    expect(body.system).toBe("you are a test");
    expect(body.temperature).toBe(0);

    expect(result.content).toEqual({ foo: "bar" });
    expect(result.tokensUsed).toBe(15);
    expect(result.model).toBe("claude-test");
  });

  it("retries once on unparsable JSON, then succeeds", async () => {
    const fetchImpl = fakeFetch([
      anthropicResponse("not json"),
      anthropicResponse('{"foo":"bar"}'),
    ]);

    const result = await callLlm({
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      apiKey: "test-key",
      model: "claude-test",
      fetchImpl,
      maxRetries: 2,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.content).toEqual({ foo: "bar" });
  });

  it("throws after exhausting retries on persistently unparsable output", async () => {
    const fetchImpl = fakeFetch([
      anthropicResponse("not json"),
      anthropicResponse("still not json"),
      anthropicResponse("nope"),
    ]);

    await expect(
      callLlm({
        system: "s",
        messages: [{ role: "user", content: "hi" }],
        apiKey: "test-key",
        model: "claude-test",
        fetchImpl,
        maxRetries: 2,
      }),
    ).rejects.toThrow();

    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("throws after exhausting retries on repeated 5xx responses", async () => {
    const fetchImpl = fakeFetch([
      { ok: false, status: 500, text: async () => "server error" },
      { ok: false, status: 503, text: async () => "unavailable" },
      { ok: false, status: 500, text: async () => "server error" },
    ]);

    await expect(
      callLlm({
        system: "s",
        messages: [{ role: "user", content: "hi" }],
        apiKey: "test-key",
        model: "claude-test",
        fetchImpl,
        maxRetries: 2,
      }),
    ).rejects.toThrow();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
