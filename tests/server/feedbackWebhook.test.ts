// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimits } from "~/server/utils/rateLimit";
import {
  buildFeedbackWebhookBody,
  notifyFeedback,
  __resetFeedbackWebhookSuppression,
} from "~/server/utils/feedbackWebhook";
import type { FeedbackRow } from "~/server/utils/feedbackStore";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  clientRef: "3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b",
  rating: 4,
  topics: ["cards", "gameplay"],
  message: "More packs please",
  source: "game_over_prompt",
  userId: null,
  lobbyCode: "AB2C",
  gamesCompletedHint: 2,
  platform: "web",
  appVersion: "3.34.0",
  notifiedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
} as FeedbackRow;

const fetchMock = vi.fn();

beforeEach(() => {
  __resetRateLimits();
  __resetFeedbackWebhookSuppression();
  fetchMock.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("$fetch", fetchMock);
  vi.stubGlobal("useRuntimeConfig", () => ({
    feedbackWebhookUrl: "https://discord.example/feedback",
    issueWebhookUrl: "https://discord.example/issues",
    public: { baseUrl: "https://unfit.cards" },
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildFeedbackWebhookBody", () => {
  it("shows stars, topic labels, the message and the admin link", () => {
    const { content } = buildFeedbackWebhookBody(row, "https://unfit.cards");
    expect(content).toContain("⭐⭐⭐⭐");
    expect(content).toContain("Cards, Gameplay");
    expect(content).toContain("More packs please");
    expect(content).toContain("https://unfit.cards/admin/feedback");
  });

  it("omits stars for an unrated comment", () => {
    const { content } = buildFeedbackWebhookBody(
      { ...row, rating: null, topics: [] },
      "https://unfit.cards",
    );
    expect(content).not.toContain("⭐");
    expect(content).toContain("Feedback");
  });

  it("strips markdown from the player's text", () => {
    const { content } = buildFeedbackWebhookBody(
      { ...row, message: "[click](https://evil.example) `x` **y**" },
      "https://unfit.cards",
    );
    expect(content).not.toContain("](");
    expect(content).not.toContain("`x`");
  });
});

describe("notifyFeedback", () => {
  it("posts to the feedback webhook with mentions disabled", async () => {
    await notifyFeedback(row);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://discord.example/feedback");
    expect(opts.body.allowed_mentions).toEqual({ parse: [] });
  });

  it("falls back to the issue webhook when no feedback URL is set", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      feedbackWebhookUrl: "",
      issueWebhookUrl: "https://discord.example/issues",
      public: { baseUrl: "https://unfit.cards" },
    }));
    await notifyFeedback(row);
    expect(fetchMock.mock.calls[0]![0]).toBe("https://discord.example/issues");
  });

  it("does nothing when no webhook is configured", async () => {
    vi.stubGlobal("useRuntimeConfig", () => ({
      feedbackWebhookUrl: "",
      issueWebhookUrl: "",
      public: { baseUrl: "https://unfit.cards" },
    }));
    await notifyFeedback(row);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does nothing for a row without a message", async () => {
    await notifyFeedback({ ...row, message: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when Discord fails", async () => {
    fetchMock.mockRejectedValue(new Error("down"));
    await expect(notifyFeedback(row)).resolves.toBeUndefined();
  });
});
