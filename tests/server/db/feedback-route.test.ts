import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { feedback } from "~/server/db/schema";
import { __resetRateLimits } from "~/server/utils/rateLimit";
import handler from "~/server/api/feedback.post";

const db = useDb();
const REF = "3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b";

function mockEvent() {
  return { node: { req: {}, res: {} } } as any;
}

function config(over: Record<string, unknown> = {}) {
  return () => ({
    feedbackWebhookUrl: "",
    issueWebhookUrl: "",
    feedbackRateLimitIp: 10,
    public: { baseUrl: "http://localhost:3000" },
    ...over,
  });
}

beforeEach(async () => {
  await db.delete(feedback);
  __resetRateLimits();
  globalThis.getRequestIP = () => "203.0.113.5";
  globalThis.getRequestHeader = () => undefined;
  globalThis.setResponseHeader = () => {};
  globalThis.setResponseStatus = () => {};
  globalThis.useRuntimeConfig = config();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/feedback", () => {
  it("stores a rating and returns nothing", async () => {
    globalThis.readBody = async () => ({
      clientRef: REF,
      rating: 5,
      source: "game_over_prompt",
      appVersion: "3.34.0",
    });
    await expect(handler(mockEvent())).resolves.toBeNull();
    const rows = await db.select().from(feedback);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.rating).toBe(5);
    expect(rows[0]!.userId).toBeNull(); // no session → anonymous, not an error
  });

  it("rejects an invalid payload with 400", async () => {
    globalThis.readBody = async () => ({ clientRef: REF, source: "game_over_prompt", appVersion: "1" });
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects a declared oversized body with 413 before parsing", async () => {
    globalThis.getRequestHeader = () => "999999";
    const readBody = vi.fn();
    globalThis.readBody = readBody;
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 413 });
    expect(readBody).not.toHaveBeenCalled();
  });

  it("rejects an oversized parsed body with 413", async () => {
    globalThis.readBody = async () => ({
      clientRef: REF,
      rating: 3,
      source: "feedback_modal",
      appVersion: "3.34.0",
      message: "x".repeat(10000),
    });
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 413 });
  });

  it("throttles per IP once the limit is exhausted", async () => {
    globalThis.useRuntimeConfig = config({ feedbackRateLimitIp: 2 });
    globalThis.readBody = async () => ({
      clientRef: REF,
      rating: 3,
      source: "feedback_modal",
      appVersion: "3.34.0",
    });
    await handler(mockEvent());
    await handler(mockEvent());
    await expect(handler(mockEvent())).rejects.toMatchObject({ statusCode: 429 });
  });

  it("notifies Discord once when a message first arrives", async () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("$fetch", fetchMock);
    globalThis.useRuntimeConfig = config({ feedbackWebhookUrl: "https://discord.example/f" });

    globalThis.readBody = async () => ({
      clientRef: REF, rating: 4, source: "game_over_prompt", appVersion: "3.34.0",
    });
    await handler(mockEvent());
    globalThis.readBody = async () => ({
      clientRef: REF, message: "love it", source: "game_over_prompt", appVersion: "3.34.0",
    });
    await handler(mockEvent());
    await handler(mockEvent());
    await new Promise((r) => setTimeout(r, 0)); // notify is not awaited

    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
