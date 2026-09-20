// @vitest-environment node
//
// POST /api/issues/report is unauthenticated and writes to a database with
// no backups. Everything this module does is a defense; none of it trusts
// the client.

import { describe, expect, it } from "vitest";
import { normalizeIssuePayload } from "~/server/utils/issueIngest";
import {
  ANOMALY_RULE_IDS,
  MESSAGE_MAX,
  STACK_MAX,
} from "~/server/utils/issueConstants";
import { WATCHDOG_RULE_IDS } from "~/utils/watchdogRules";

const valid = {
  kind: "client-error",
  message: "Cannot read properties of undefined",
  appVersion: "3.19.0",
};

describe("normalizeIssuePayload", () => {
  it("accepts a minimal valid payload", () => {
    const result = normalizeIssuePayload(valid);
    expect(result.ok).toBe(true);
  });

  it("rejects an unknown kind", () => {
    const result = normalizeIssuePayload({ ...valid, kind: "not-a-kind" });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects a missing message", () => {
    const result = normalizeIssuePayload({ ...valid, message: "   " });
    expect(result).toMatchObject({ ok: false });
  });

  it("truncates an overlong message rather than rejecting it", () => {
    const result = normalizeIssuePayload({ ...valid, message: "x".repeat(9000) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toHaveLength(MESSAGE_MAX);
  });

  it("truncates an overlong stack", () => {
    const result = normalizeIssuePayload({ ...valid, stack: "y".repeat(9000) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.stack).toHaveLength(STACK_MAX);
  });

  it("drops context keys outside the allowlist", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { phase: "judging", chatLog: ["something private"], evil: 1 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.context).toEqual({ phase: "judging" });
      expect(result.value.context).not.toHaveProperty("chatLog");
    }
  });

  it("coerces a non-object context to null", () => {
    const result = normalizeIssuePayload({ ...valid, context: "nope" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toBeNull();
  });

  it("derives a title capped at 120 characters", () => {
    const result = normalizeIssuePayload({ ...valid, message: "z".repeat(400) });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.title).toHaveLength(120);
  });

  it("attaches a fingerprint", () => {
    const result = normalizeIssuePayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults a missing appVersion rather than failing", () => {
    const { appVersion, ...noVersion } = valid;
    const result = normalizeIssuePayload(noVersion);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.appVersion).toBe("unknown");
  });

  it("drops a permitted key whose value is a nested object", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { phase: { note: "an entire chat transcript" } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toBeNull();
  });

  it("drops a permitted key whose string value is oversized", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { phase: "x".repeat(500), round: 3 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toEqual({ round: 3 });
  });

  it("drops a handSizes map carrying non-numeric values", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { handSizes: { alice: "a whole sentence" } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toBeNull();
  });

  it("drops a handSizes map whose keys are not short strings", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { handSizes: { ["chat: ".repeat(200)]: 7 } },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toBeNull();
  });

  it("keeps a well-formed lobby code and drops a malformed one", () => {
    const good = normalizeIssuePayload({ ...valid, lobbyCode: "AB2C" });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.value.lobbyCode).toBe("AB2C");

    const bad = normalizeIssuePayload({ ...valid, lobbyCode: "../../etc/passwd" });
    expect(bad.ok).toBe(true);
    if (bad.ok) expect(bad.value.lobbyCode).toBeNull();
  });

  it("keeps a well-formed structural context intact", () => {
    const context = {
      phase: "judging",
      round: 4,
      judgeId: "3f2a1b4c-5d6e-7f80-9a1b-2c3d4e5f6071",
      activePlayerCount: 5,
      submissionCount: 4,
      handSizes: { alice: 7, bob: 6 },
      isHost: true,
    };
    const result = normalizeIssuePayload({ ...valid, context });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toEqual(context);
  });

  it("keeps a well-formed api-error context intact", () => {
    const context = { method: "POST", statusCode: 500 };
    const result = normalizeIssuePayload({
      kind: "api-error",
      message: "DB connection reset",
      appVersion: "3.19.0",
      route: "/api/lobby/AB2C/leave",
      context,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.context).toEqual(context);
      expect(result.value.route).toBe("/api/lobby/AB2C/leave");
    }
  });

  it("drops a statusCode outside the valid HTTP range", () => {
    const result = normalizeIssuePayload({
      ...valid,
      context: { statusCode: 99999 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.context).toBeNull();
  });
});

describe("anomaly validation", () => {
  const anomaly = {
    kind: "anomaly",
    message: "Phase stuck at submitting-complete",
    appVersion: "3.19.0",
  };

  it("accepts a known ruleId and phase", () => {
    const result = normalizeIssuePayload({
      ...anomaly,
      context: { ruleId: "settle-stalled", phase: "submitting-complete" },
    });
    expect(result.ok).toBe(true);
  });

  // Both halves feed the fingerprint, so an unbounded pair means unbounded
  // permanent group rows on a database with no backups.
  it("rejects an unknown ruleId", () => {
    const result = normalizeIssuePayload({
      ...anomaly,
      context: { ruleId: "made-up-rule", phase: "judging" },
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an unknown phase", () => {
    const result = normalizeIssuePayload({
      ...anomaly,
      context: { ruleId: "settle-stalled", phase: "not-a-phase" },
    });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects an anomaly with no context at all", () => {
    const result = normalizeIssuePayload(anomaly);
    expect(result).toMatchObject({ ok: false });
  });

  it("leaves other kinds unaffected by the allowlist", () => {
    const result = normalizeIssuePayload({
      kind: "client-error",
      message: "boom",
      appVersion: "3.19.0",
      context: { ruleId: "anything", phase: "whatever" },
    });
    expect(result.ok).toBe(true);
  });
});

describe("game-diagnostic context fields", () => {
  const report = {
    kind: "player-report" as const,
    message: "cards still stuck",
    appVersion: "3.24.3",
  };

  const ctx = (context: Record<string, unknown>) =>
    normalizeIssuePayload({ ...report, context });

  const kept = (context: Record<string, unknown>, key: string) => {
    const result = ctx(context);
    if (!result.ok) throw new Error("payload was rejected outright");
    return result.value.context?.[key as keyof typeof result.value.context];
  };

  it("keeps the ids of who played and who was skipped", () => {
    const context = {
      submittedPlayerIds: ["p-1", "p-2"],
      skippedPlayerIds: ["p-3"],
    };
    expect(kept(context, "submittedPlayerIds")).toEqual(["p-1", "p-2"]);
    expect(kept(context, "skippedPlayerIds")).toEqual(["p-3"]);
  });

  it("drops an id list longer than a roster can be", () => {
    const ids = Array.from({ length: 33 }, (_, i) => `p-${i}`);
    expect(kept({ submittedPlayerIds: ids }, "submittedPlayerIds")).toBeUndefined();
  });

  it("drops an id list carrying prose rather than an id", () => {
    expect(
      kept({ submittedPlayerIds: ["x".repeat(200)] }, "submittedPlayerIds"),
    ).toBeUndefined();
  });

  // An empty list means the watchdog looked and saw nothing, which is not the
  // same as never having looked. The guard has to keep it.
  it("keeps an empty rule list", () => {
    expect(kept({ activeRuleIds: [] }, "activeRuleIds")).toEqual([]);
  });

  it("keeps rule ids this build knows", () => {
    expect(kept({ activeRuleIds: ["judging-empty"] }, "activeRuleIds")).toEqual([
      "judging-empty",
    ]);
  });

  // Unlike `ruleId` on an anomaly, an unknown entry here drops the field
  // instead of refusing the report: it is context, not the fingerprint, and a
  // client one deploy ahead still has something worth keeping.
  it("drops unknown rule ids without losing the report", () => {
    const result = ctx({ activeRuleIds: ["not-a-rule"], phase: "submitting" });
    expect(result.ok).toBe(true);
    expect(kept({ activeRuleIds: ["not-a-rule"] }, "activeRuleIds")).toBeUndefined();
  });

  it("keeps a plausible phase age and drops an implausible one", () => {
    expect(kept({ phaseAgeMs: 45_000 }, "phaseAgeMs")).toBe(45_000);
    expect(kept({ phaseAgeMs: -1 }, "phaseAgeMs")).toBeUndefined();
    expect(kept({ phaseAgeMs: 9e15 }, "phaseAgeMs")).toBeUndefined();
  });

  it("keeps the link fields", () => {
    const context = {
      wsState: "connected",
      wsSynced: true,
      reconnectCount: 2,
      bufferedMessages: 7,
    };
    expect(kept(context, "wsState")).toBe("connected");
    expect(kept(context, "wsSynced")).toBe(true);
    expect(kept(context, "reconnectCount")).toBe(2);
    expect(kept(context, "bufferedMessages")).toBe(7);
  });

  it("drops a transport state nobody defined", () => {
    expect(kept({ wsState: "vibing" }, "wsState")).toBeUndefined();
  });

  // The cap on permanent anomaly groups is the whole reason the context
  // allowlist exists. None of these fields may widen it.
  it("does not let the new fields reach the fingerprint", () => {
    const anomalyBase = {
      kind: "anomaly" as const,
      message: "Still submitting with all plays in",
      appVersion: "3.24.3",
    };
    const bare = normalizeIssuePayload({
      ...anomalyBase,
      context: { ruleId: "submitting-settled", phase: "submitting" },
    });
    const loaded = normalizeIssuePayload({
      ...anomalyBase,
      context: {
        ruleId: "submitting-settled",
        phase: "submitting",
        submittedPlayerIds: ["p-1"],
        skippedPlayerIds: ["p-2"],
        activeRuleIds: ["submitting-settled"],
        phaseAgeMs: 61_000,
        wsState: "disconnected",
        wsSynced: false,
        reconnectCount: 4,
        bufferedMessages: 12,
      },
    });

    if (!bare.ok || !loaded.ok) throw new Error("payload was rejected");
    expect(loaded.value.fingerprint).toBe(bare.value.fingerprint);
  });
});

describe("watchdog rule ids match the server allowlist", () => {
  // The client decides what to send and the server decides what to accept.
  // If these drift, the watchdog silently starts getting 400s in production
  // and the anomalies it exists to surface never arrive.
  it("has exactly the same set on both sides", () => {
    expect([...ANOMALY_RULE_IDS].sort()).toEqual([...WATCHDOG_RULE_IDS].sort());
  });
});
