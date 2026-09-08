// @vitest-environment node
//
// Fingerprinting is what turns 4,000 events into 12 admin rows. Too coarse
// and distinct bugs merge; too fine and one bug fragments into hundreds of
// groups and the Discord webhook becomes unusable.

import { describe, expect, it } from "vitest";
import {
  computeFingerprint,
  normalizeMessage,
} from "~/server/utils/issueFingerprint";

describe("normalizeMessage", () => {
  it("collapses UUIDs so one bug does not fragment per card id", () => {
    const a = normalizeMessage(
      "Failed to resolve card 3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071",
    );
    const b = normalizeMessage(
      "Failed to resolve card 9b1c2d3e-4f50-6a7b-8c9d-0e1f2a3b4c5d",
    );
    expect(a).toBe(b);
    expect(a).toContain("<uuid>");
  });

  it("collapses teleportal lobby doc ids", () => {
    expect(normalizeMessage("doc lobby-AB2C vanished")).toBe(
      normalizeMessage("doc lobby-XY9Z vanished"),
    );
  });

  it("collapses standalone numbers", () => {
    expect(normalizeMessage("hand had 7 cards")).toBe(
      normalizeMessage("hand had 4 cards"),
    );
  });

  it("collapses quoted string literals", () => {
    expect(normalizeMessage('player "Dylan" left')).toBe(
      normalizeMessage('player "Sam" left'),
    );
  });

  // Codes are 4 chars of ABCDEFGHJKLMNPQRSTUVWXYZ23456789, so a blanket
  // [A-HJ-NP-Z2-9]{4} rule would also rewrite HTTP and TEXT. Only the
  // lobby- prefixed form is unambiguous enough to touch.
  it("leaves bare uppercase words alone", () => {
    const out = normalizeMessage("HTTP request failed reading TEXT");
    expect(out).toContain("http");
    expect(out).toContain("text");
    expect(out).not.toContain("<code>");
  });

  // Regression: the apostrophes in "hasn't" and "player's" used to be read as
  // one quoted pair, swallowing everything between them.
  it("does not treat contraction apostrophes as quote delimiters", () => {
    const out = normalizeMessage(
      "Judge hasn't picked a winner, player's hand is empty",
    );
    expect(out).toContain("picked a winner");
    expect(out).not.toContain("<str>");
  });

  it("still collapses a genuine single-quoted token", () => {
    expect(
      normalizeMessage("Cannot read properties of undefined (reading 'id')"),
    ).toBe(
      normalizeMessage(
        "Cannot read properties of undefined (reading 'phase')",
      ),
    );
  });
});

describe("computeFingerprint", () => {
  it("is stable for the same normalized message and frame", () => {
    const one = computeFingerprint({
      kind: "client-error",
      message: "Cannot read properties of undefined (reading 'id')",
      stack: "at useLobby (app.js:1:1)\nat setup (app.js:2:2)",
    });
    const two = computeFingerprint({
      kind: "client-error",
      message: "Cannot read properties of undefined (reading 'id')",
      stack: "at useLobby (app.js:1:1)\nat somethingElse (app.js:9:9)",
    });
    expect(one).toBe(two);
  });

  it("separates different kinds with the same message", () => {
    expect(
      computeFingerprint({ kind: "client-error", message: "boom" }),
    ).not.toBe(computeFingerprint({ kind: "server-error", message: "boom" }));
  });

  it("fingerprints anomalies on ruleId and phase, ignoring the message", () => {
    const base = { kind: "anomaly" as const, context: { ruleId: "judging-empty", phase: "judging" } };
    expect(computeFingerprint({ ...base, message: "stuck for 31s" })).toBe(
      computeFingerprint({ ...base, message: "stuck for 47s" }),
    );
  });

  it("gives every player report its own group", () => {
    const input = { kind: "player-report" as const, message: "it froze" };
    expect(computeFingerprint(input)).not.toBe(computeFingerprint(input));
  });
});
