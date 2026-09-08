// @vitest-environment node
//
// The webhook is the only part of this pipeline the operator actually sees
// day to day, and it is the part most able to make itself useless: a bad
// deploy that sprays 400 alerts trains you to mute the channel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "~/server/utils/rateLimit";
import {
  buildIssueWebhookBody,
  notifyIssue,
  __resetWebhookSuppression,
  __shouldSendWebhook,
} from "~/server/utils/issueWebhook";
import type { RecordIssueResult } from "~/server/utils/issueStore";

const result: RecordIssueResult = {
  groupId: "11111111-1111-1111-1111-111111111111",
  kind: "client-error",
  title: "Cannot read properties of undefined",
  lobbyCode: "AB2C",
  appVersion: "3.19.0",
  shouldNotify: true,
  isRegression: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-08T12:00:00Z"));
  __resetRateLimits();
  // The suppression counter is module state and survives __resetRateLimits.
  // Without this, the count carried by one test leaks into the next.
  __resetWebhookSuppression();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildIssueWebhookBody", () => {
  it("includes kind, title, lobby, version and a deep link", () => {
    const body = buildIssueWebhookBody(result, "https://unfit.cards");
    expect(body.content).toContain("client-error");
    expect(body.content).toContain("Cannot read properties of undefined");
    expect(body.content).toContain("AB2C");
    expect(body.content).toContain("3.19.0");
    expect(body.content).toContain(
      "https://unfit.cards/admin/issues/11111111-1111-1111-1111-111111111111",
    );
  });

  it("marks a regression distinctly from a new issue", () => {
    const body = buildIssueWebhookBody({ ...result, isRegression: true }, "https://unfit.cards");
    expect(body.content.toLowerCase()).toContain("regress");
  });

  it("strips markdown from attacker-supplied title and lobby code", () => {
    const body = buildIssueWebhookBody(
      {
        ...result,
        title: "[Open in admin](https://evil.example)",
        lobbyCode: "`\nAB2C",
      },
      "https://unfit.cards",
    );
    expect(body.content).not.toContain("](");
    expect(body.content).not.toContain("`\n");
    expect(body.content).toContain("https://unfit.cards/admin/issues/");
  });
});

describe("__shouldSendWebhook", () => {
  it("allows up to the per-window cap", () => {
    for (let i = 0; i < 5; i++) {
      expect(__shouldSendWebhook().send).toBe(true);
    }
  });

  it("suppresses past the cap and reports how many were suppressed", () => {
    for (let i = 0; i < 5; i++) __shouldSendWebhook();

    const sixth = __shouldSendWebhook();
    expect(sixth.send).toBe(false);
    expect(sixth.suppressedCount).toBe(1);

    const seventh = __shouldSendWebhook();
    expect(seventh.send).toBe(false);
    expect(seventh.suppressedCount).toBe(2);
  });

  it("allows again once the window rolls over", () => {
    for (let i = 0; i < 6; i++) __shouldSendWebhook();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    expect(__shouldSendWebhook().send).toBe(true);
  });
});

describe("notifyIssue", () => {
  const configured = {
    issueWebhookUrl: "https://discord.example/webhook",
    public: { baseUrl: "https://unfit.cards" },
  };

  afterEach(() => {
    // These tests stub Nitro globals directly on globalThis; other test
    // files in the same worker must not inherit them.
    // @ts-ignore
    delete globalThis.useRuntimeConfig;
    // @ts-ignore
    delete globalThis.$fetch;
  });

  it("never throws when the transport rejects", async () => {
    // @ts-ignore — Nitro globals are provided by the runtime in production
    globalThis.useRuntimeConfig = () => configured;
    // @ts-ignore
    globalThis.$fetch = vi.fn().mockRejectedValue(new Error("discord down"));

    await expect(notifyIssue(result)).resolves.toBeUndefined();
  });

  it("never throws when the transport throws synchronously", async () => {
    // @ts-ignore
    globalThis.useRuntimeConfig = () => configured;
    // @ts-ignore
    globalThis.$fetch = vi.fn(() => {
      throw new Error("boom");
    });

    await expect(notifyIssue(result)).resolves.toBeUndefined();
  });

  it("never throws when config access itself fails", async () => {
    // @ts-ignore
    globalThis.useRuntimeConfig = () => {
      throw new Error("no config in this context");
    };

    await expect(notifyIssue(result)).resolves.toBeUndefined();
  });

  it("sends nothing when the group should not notify", async () => {
    // @ts-ignore
    globalThis.useRuntimeConfig = () => configured;
    const spy = vi.fn().mockResolvedValue(null);
    // @ts-ignore
    globalThis.$fetch = spy;

    await notifyIssue({ ...result, shouldNotify: false });

    expect(spy).not.toHaveBeenCalled();
  });

  it("suppresses mention parsing in what it posts", async () => {
    // @ts-ignore
    globalThis.useRuntimeConfig = () => configured;
    const spy = vi.fn().mockResolvedValue(null);
    // @ts-ignore
    globalThis.$fetch = spy;

    await notifyIssue({ ...result, title: "@everyone the game is broken" });

    expect(spy).toHaveBeenCalledTimes(1);
    const [, options] = spy.mock.calls[0];
    expect(options.body.allowed_mentions).toEqual({ parse: [] });
  });

  it("posts a standalone suppression notice on the first suppressed event of the window, then stays quiet", async () => {
    // @ts-ignore
    globalThis.useRuntimeConfig = () => configured;
    const spy = vi.fn().mockResolvedValue(null);
    // @ts-ignore
    globalThis.$fetch = spy;

    // Exhaust the per-window cap so the next notifyIssue call is refused.
    for (let i = 0; i < 5; i++) __shouldSendWebhook();

    await notifyIssue(result);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].body.content.toLowerCase()).toContain("suppress");

    await notifyIssue(result);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
