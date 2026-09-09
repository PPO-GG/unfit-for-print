// @vitest-environment node
//
// Fingerprinting is what turns 4,000 events into 12 admin rows. Too coarse
// and distinct bugs merge; too fine and one bug fragments into hundreds of
// groups and the Discord webhook becomes unusable.

import { describe, expect, it } from "vitest";
import {
  computeFingerprint,
  normalizeMessage,
  normalizeRoute,
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

describe("normalizeRoute", () => {
  // Message normalization deliberately leaves bare lobby codes alone (HTTP,
  // TEXT are real English words). That caution doesn't apply to URL path
  // segments — a segment that IS a lobby code should collapse regardless,
  // since the whole point is grouping repeat failures of one dynamic route.
  it("collapses a bare lobby-code segment", () => {
    expect(normalizeRoute("/api/lobby/AB2C/leave")).toBe(
      normalizeRoute("/api/lobby/XY9Z/leave"),
    );
  });

  it("collapses a UUID segment", () => {
    expect(
      normalizeRoute("/api/players/3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071"),
    ).toBe(
      normalizeRoute("/api/players/9b1c2d3e-4f50-6a7b-8c9d-0e1f2a3b4c5d"),
    );
  });

  it("collapses a purely numeric segment", () => {
    expect(normalizeRoute("/api/rounds/7")).toBe(normalizeRoute("/api/rounds/42"));
  });

  it("collapses a long opaque token segment", () => {
    expect(normalizeRoute("/api/cards/images/abcdefghijklmnopqrstuvwxyz1234")).toBe(
      normalizeRoute("/api/cards/images/zyxwvutsrqponmlkjihgfedcba4321"),
    );
  });

  it("leaves ordinary static path words untouched", () => {
    expect(normalizeRoute("/api/lobby/create")).toBe("/api/lobby/create");
  });

  it("is stable regardless of a trailing slash", () => {
    expect(normalizeRoute("/api/lobby/create/")).toBe(
      normalizeRoute("/api/lobby/create"),
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

  describe("api-error", () => {
    const base = {
      kind: "api-error" as const,
      route: "/api/lobby/AB2C/leave",
      context: { method: "POST", statusCode: 500 },
    };

    it("fingerprints on method + route pattern + status, ignoring the message", () => {
      expect(computeFingerprint({ ...base, message: "DB connection reset" })).toBe(
        computeFingerprint({ ...base, message: "constraint violation" }),
      );
    });

    it("groups the same dynamic route across different lobby codes", () => {
      const other = { ...base, route: "/api/lobby/XY9Z/leave" };
      expect(computeFingerprint({ ...base, message: "a" })).toBe(
        computeFingerprint({ ...other, message: "b" }),
      );
    });

    it("separates a different status on the same route", () => {
      const other = { ...base, context: { ...base.context, statusCode: 503 } };
      expect(computeFingerprint(base)).not.toBe(computeFingerprint(other));
    });

    it("separates a different method on the same route", () => {
      const other = { ...base, context: { ...base.context, method: "GET" } };
      expect(computeFingerprint(base)).not.toBe(computeFingerprint(other));
    });

    it("separates a genuinely different route", () => {
      const other = { ...base, route: "/api/cards/random" };
      expect(computeFingerprint(base)).not.toBe(computeFingerprint(other));
    });

    it("does not throw when route, method, or statusCode is missing", () => {
      expect(() =>
        computeFingerprint({ kind: "api-error", message: "boom" }),
      ).not.toThrow();
    });
  });
});
