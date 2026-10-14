// @vitest-environment node
//
// POST /api/feedback is unauthenticated. Everything here is a defense; none
// of it trusts the client.

import { describe, expect, it } from "vitest";
import { normalizeFeedbackPayload } from "~/server/utils/feedbackIngest";
import { FEEDBACK_MESSAGE_MAX } from "#shared/feedback";

const REF = "3f2b8c1e-9d4a-4f6b-8a2e-1c5d7e9f0a1b";
const valid = {
  clientRef: REF,
  rating: 4,
  source: "game_over_prompt",
  appVersion: "3.34.0",
};

describe("normalizeFeedbackPayload", () => {
  it("accepts a rating-only payload", () => {
    const r = normalizeFeedbackPayload(valid);
    expect(r).toEqual({
      ok: true,
      value: {
        clientRef: REF,
        rating: 4,
        topics: [],
        message: null,
        source: "game_over_prompt",
        lobbyCode: null,
        gamesCompletedHint: null,
        platform: null,
        appVersion: "3.34.0",
      },
    });
  });

  it("accepts a message-only payload", () => {
    const r = normalizeFeedbackPayload({
      ...valid,
      rating: undefined,
      message: "more packs please",
      source: "feedback_modal",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.rating).toBeNull();
      expect(r.value.message).toBe("more packs please");
    }
  });

  it("rejects a payload with neither rating nor message", () => {
    expect(
      normalizeFeedbackPayload({ ...valid, rating: null, message: "   " }),
    ).toMatchObject({ ok: false });
  });

  it.each([["5"], [4.5], [0], [6], [-1], [Number.NaN]])(
    "rejects rating %p rather than coercing it",
    (rating) => {
      expect(normalizeFeedbackPayload({ ...valid, rating })).toMatchObject({
        ok: false,
      });
    },
  );

  it("rejects a missing or malformed clientRef", () => {
    expect(
      normalizeFeedbackPayload({ ...valid, clientRef: undefined }),
    ).toMatchObject({ ok: false });
    expect(
      normalizeFeedbackPayload({ ...valid, clientRef: "not-a-uuid" }),
    ).toMatchObject({ ok: false });
  });

  it("rejects an unknown source", () => {
    expect(
      normalizeFeedbackPayload({ ...valid, source: "email" }),
    ).toMatchObject({ ok: false });
  });

  it("rejects a missing appVersion", () => {
    expect(
      normalizeFeedbackPayload({ ...valid, appVersion: "" }),
    ).toMatchObject({ ok: false });
  });

  it("rejects a non-object body", () => {
    expect(normalizeFeedbackPayload(null)).toMatchObject({ ok: false });
    expect(normalizeFeedbackPayload([valid])).toMatchObject({ ok: false });
    expect(normalizeFeedbackPayload("hi")).toMatchObject({ ok: false });
  });

  it("filters topics to the allowlist and dedupes them", () => {
    const r = normalizeFeedbackPayload({
      ...valid,
      topics: ["cards", "cards", "evil", 7, "bots"],
    });
    expect(r.ok && r.value.topics).toEqual(["cards", "bots"]);
  });

  it("truncates an overlong message rather than rejecting it", () => {
    const r = normalizeFeedbackPayload({
      ...valid,
      message: "x".repeat(5000),
    });
    expect(r.ok && r.value.message).toHaveLength(FEEDBACK_MESSAGE_MAX);
  });

  it("trims the message and treats whitespace-only as absent", () => {
    const r = normalizeFeedbackPayload({ ...valid, message: "  \n  " });
    expect(r.ok && r.value.message).toBeNull();
    const r2 = normalizeFeedbackPayload({ ...valid, message: "  hi  " });
    expect(r2.ok && r2.value.message).toBe("hi");
  });

  it("keeps only known platforms", () => {
    const a = normalizeFeedbackPayload({ ...valid, platform: "discord-activity" });
    expect(a.ok && a.value.platform).toBe("discord-activity");
    const b = normalizeFeedbackPayload({ ...valid, platform: "ios-app" });
    expect(b.ok && b.value.platform).toBeNull();
  });

  it("accepts a sane games hint and drops nonsense", () => {
    const a = normalizeFeedbackPayload({ ...valid, gamesCompletedHint: 12 });
    expect(a.ok && a.value.gamesCompletedHint).toBe(12);
    const b = normalizeFeedbackPayload({ ...valid, gamesCompletedHint: -3 });
    expect(b.ok && b.value.gamesCompletedHint).toBeNull();
    const c = normalizeFeedbackPayload({ ...valid, gamesCompletedHint: 1.5 });
    expect(c.ok && c.value.gamesCompletedHint).toBeNull();
    const d = normalizeFeedbackPayload({ ...valid, gamesCompletedHint: 1e9 });
    expect(d.ok && d.value.gamesCompletedHint).toBe(100000);
  });

  it("truncates the lobby code", () => {
    const r = normalizeFeedbackPayload({ ...valid, lobbyCode: "A".repeat(50) });
    expect(r.ok && r.value.lobbyCode).toHaveLength(16);
  });
});
