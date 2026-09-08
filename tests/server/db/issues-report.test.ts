import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import { __resetRateLimits } from "~/server/utils/rateLimit";
import handler from "~/server/api/issues/report.post";

const db = useDb();

function mockEvent() {
  return { node: { req: {}, res: {} } } as any;
}

beforeEach(async () => {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
  __resetRateLimits();

  // setup.ts stubs defineEventHandler and createError; these are the extra
  // Nitro globals this route reaches for.
  globalThis.getRequestIP = () => "203.0.113.5";
  globalThis.getRequestHeader = () => undefined;
  globalThis.setResponseHeader = () => {};
  globalThis.setResponseStatus = () => {};
  globalThis.useRuntimeConfig = () => ({
    issueWebhookUrl: "",
    issueRateLimitIp: 30,
    issueRateLimitLobby: 60,
    public: { baseUrl: "http://localhost:3000" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/issues/report", () => {
  it("stores a valid report and returns nothing", async () => {
    globalThis.readBody = async () => ({
      kind: "client-error",
      message: "Cannot read properties of undefined",
      appVersion: "3.19.0",
      lobbyCode: "AB2C",
    });

    await handler(mockEvent());

    const groups = await db.select().from(issueGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.title).toBe("Cannot read properties of undefined");
  });

  it("rejects an unknown kind with 400", async () => {
    globalThis.readBody = async () => ({ kind: "nope", message: "x" });
    await expect(handler(mockEvent())).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("rejects an oversized body with 413 before parsing it", async () => {
    globalThis.readBody = async () => ({
      kind: "client-error",
      message: "x".repeat(20000),
      stack: "y".repeat(20000),
      appVersion: "3.19.0",
    });
    await expect(handler(mockEvent())).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("throttles per IP once the limit is exhausted", async () => {
    globalThis.useRuntimeConfig = () => ({
      issueWebhookUrl: "",
      issueRateLimitIp: 2,
      issueRateLimitLobby: 60,
      public: { baseUrl: "http://localhost:3000" },
    });
    globalThis.readBody = async () => ({
      kind: "client-error",
      message: "boom",
      appVersion: "3.19.0",
    });

    await handler(mockEvent());
    await handler(mockEvent());
    await expect(handler(mockEvent())).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("rejects an oversized declared body without parsing it", async () => {
    globalThis.getRequestHeader = () => String(8192 + 1);
    // If the route reaches the parser at all, this throws something other
    // than a 413 and the assertion below fails — which is the point.
    globalThis.readBody = async () => {
      throw new Error("readBody must not run once Content-Length exceeds the cap");
    };

    await expect(handler(mockEvent())).rejects.toMatchObject({
      statusCode: 413,
    });
  });

  it("throttles per lobby code once that bucket is exhausted", async () => {
    // ipRateLimit 0 disables the per-IP bucket, isolating the per-lobby one.
    globalThis.useRuntimeConfig = () => ({
      issueWebhookUrl: "",
      issueRateLimitIp: 0,
      issueRateLimitLobby: 2,
      public: { baseUrl: "http://localhost:3000" },
    });
    globalThis.readBody = async () => ({
      kind: "client-error",
      message: "boom",
      appVersion: "3.19.0",
      lobbyCode: "AB2C",
    });

    await handler(mockEvent());
    await handler(mockEvent());
    await expect(handler(mockEvent())).rejects.toMatchObject({
      statusCode: 429,
    });
  });

  it("stores no chat or card text even if the client sends some", async () => {
    globalThis.readBody = async () => ({
      kind: "player-report",
      message: "it froze",
      appVersion: "3.19.0",
      context: { phase: "judging", chatLog: ["private"], cardText: "rude" },
    });

    await handler(mockEvent());

    const [event] = await db.select().from(issueEvents);
    expect(event!.context).toEqual({ phase: "judging" });
  });
});
