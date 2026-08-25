import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signActivityToken, verifyActivityToken } from "~/server/utils/activityToken";

beforeEach(() => {
  process.env.NUXT_ACTIVITY_TOKEN_SECRET = "test-secret-at-least-32-chars-long";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("activity token", () => {
  it("round-trips a valid token", () => {
    const token = signActivityToken("user-123");
    const result = verifyActivityToken(token);
    expect(result).toEqual({ userId: "user-123" });
  });

  it("rejects a tampered payload", () => {
    const token = signActivityToken("user-123");
    const [payload, sig] = token.split(".");
    const tampered = `${Buffer.from(JSON.stringify({ userId: "attacker", exp: Date.now() + 100000 })).toString("base64url")}.${sig}`;
    expect(verifyActivityToken(tampered)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(verifyActivityToken("not-a-real-token")).toBeNull();
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    const token = signActivityToken("user-123");
    vi.advanceTimersByTime(25 * 60 * 60 * 1000);
    expect(verifyActivityToken(token)).toBeNull();
  });
});
