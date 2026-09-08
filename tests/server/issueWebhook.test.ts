// @vitest-environment node
//
// The webhook is the only part of this pipeline the operator actually sees
// day to day, and it is the part most able to make itself useless: a bad
// deploy that sprays 400 alerts trains you to mute the channel.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "~/server/utils/rateLimit";
import {
  buildIssueWebhookBody,
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
