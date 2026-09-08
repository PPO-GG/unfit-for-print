// @vitest-environment node
//
// POST /api/issues/report is unauthenticated and writes to a database with
// no backups. Everything this module does is a defense; none of it trusts
// the client.

import { describe, expect, it } from "vitest";
import { normalizeIssuePayload } from "~/server/utils/issueIngest";
import { MESSAGE_MAX, STACK_MAX } from "~/server/utils/issueConstants";

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
});
