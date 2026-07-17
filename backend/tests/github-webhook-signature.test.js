import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { verifyWebhookSignature } from "../src/utils/github-webhook-signature.js";

const SECRET = "test-webhook-secret";

function sign(body, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  it("accepts a correctly signed payload", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const signature = sign(body);
    expect(verifyWebhookSignature({ body, signature, secret: SECRET })).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const signature = sign(body, "wrong-secret");
    expect(verifyWebhookSignature({ body, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a tampered body against an otherwise-valid signature", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    const signature = sign(body);
    const tamperedBody = Buffer.from(JSON.stringify({ hello: "attacker" }));
    expect(verifyWebhookSignature({ body: tamperedBody, signature, secret: SECRET })).toBe(false);
  });

  it("rejects a missing signature header", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    expect(verifyWebhookSignature({ body, signature: undefined, secret: SECRET })).toBe(false);
  });

  it("rejects a malformed signature (no sha256= prefix)", () => {
    const body = Buffer.from(JSON.stringify({ hello: "world" }));
    expect(verifyWebhookSignature({ body, signature: "not-a-real-signature", secret: SECRET })).toBe(false);
  });
});
