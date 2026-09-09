// @vitest-environment node
//
// The Nitro error hook runs inside Nitro's own error-handling chain, so a
// throw from here is the one place recursion becomes a real risk rather
// than theoretical. Every capture path is tested pure (no Nitro, no DB);
// captureNitroError's "never throws" property is proven with an injected
// record/notify that itself throws — mirroring how useIssueReporter and
// notifyIssue were tested.

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildNitroErrorReport,
  captureNitroError,
  shouldCaptureNitroError,
} from "~/server/utils/issueNitroErrors";
import type { RecordIssueResult } from "~/server/utils/issueStore";

describe("shouldCaptureNitroError", () => {
  it("captures a genuine 500", () => {
    expect(shouldCaptureNitroError(500, "/api/lobby/create")).toBe(true);
  });

  it("ignores 4xx — that is expected validation traffic, not a bug", () => {
    expect(shouldCaptureNitroError(404, "/api/lobby/create")).toBe(false);
    expect(shouldCaptureNitroError(429, "/api/issues/report")).toBe(false);
  });

  it("ignores an error with no route at all", () => {
    expect(shouldCaptureNitroError(500, undefined)).toBe(false);
  });

  // The one failure mode this pipeline cannot survive: an error thrown
  // while recording an issue trying to record itself.
  it("excludes the public issues namespace outright, even at 500", () => {
    expect(shouldCaptureNitroError(500, "/api/issues/report")).toBe(false);
  });

  // The admin issue routes read/update issueGroups directly — they never
  // call recordIssue, so they carry none of the recursion risk and are a
  // legitimate source of errors worth capturing like any other route.
  it("does NOT exclude the admin issue routes", () => {
    expect(shouldCaptureNitroError(500, "/api/admin/issues/status")).toBe(true);
  });

  it("captures every other 5xx", () => {
    expect(shouldCaptureNitroError(502, "/api/lobby/create")).toBe(true);
    expect(shouldCaptureNitroError(503, "/api/lobby/create")).toBe(true);
  });
});

describe("buildNitroErrorReport", () => {
  it("builds an api-error report from a real Error", () => {
    const error = Object.assign(new Error("DB connection reset"), {
      statusCode: 500,
    });
    const report = buildNitroErrorReport(error, {
      path: "/api/lobby/AB2C/leave",
      method: "POST",
    });

    expect(report).toMatchObject({
      kind: "api-error",
      message: "DB connection reset",
      route: "/api/lobby/AB2C/leave",
      context: { method: "POST", statusCode: 500 },
    });
    expect(report.stack).toContain("DB connection reset");
  });

  // A bare `throw new Error(...)` (not createError) carries no statusCode —
  // Nitro's own defaultHandler treats that as 500, and so do we.
  it("defaults to 500 when the thrown error carries no statusCode", () => {
    const report = buildNitroErrorReport(new Error("boom"), {
      path: "/api/lobby/create",
      method: "POST",
    });
    expect(report.context.statusCode).toBe(500);
  });

  it("handles a thrown non-Error value without crashing", () => {
    const report = buildNitroErrorReport("just a string", {
      path: "/api/lobby/create",
      method: "GET",
    });
    expect(report.message).toContain("just a string");
    expect(report.context.statusCode).toBe(500);
  });

  it("carries the app version through when supplied", () => {
    const report = buildNitroErrorReport(
      new Error("boom"),
      { path: "/api/lobby/create", method: "POST" },
      "3.19.0",
    );
    expect(report.appVersion).toBe("3.19.0");
  });
});

const okResult: RecordIssueResult = {
  groupId: "11111111-1111-1111-1111-111111111111",
  kind: "api-error",
  title: "DB connection reset",
  lobbyCode: null,
  appVersion: "3.19.0",
  shouldNotify: true,
  isRegression: false,
};

describe("captureNitroError", () => {
  beforeEach(() => {
    // setup.ts stubs defineEventHandler and createError only; captureNitroError
    // additionally reaches for useRuntimeConfig to read the running app version.
    // @ts-ignore
    globalThis.useRuntimeConfig = () => ({ public: { appVersion: "3.19.0" } });
  });

  it("records a genuine 500 and notifies", async () => {
    const record = vi.fn().mockResolvedValue(okResult);
    const notify = vi.fn().mockResolvedValue(undefined);

    await captureNitroError(
      Object.assign(new Error("boom"), { statusCode: 500 }),
      { event: { path: "/api/lobby/create", method: "POST" } as any, tags: ["request"] },
      { record, notify },
    );

    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toMatchObject({ kind: "api-error" });
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the group says not to", async () => {
    const record = vi.fn().mockResolvedValue({ ...okResult, shouldNotify: false });
    const notify = vi.fn();

    await captureNitroError(
      Object.assign(new Error("boom"), { statusCode: 500 }),
      { event: { path: "/api/lobby/create", method: "POST" } as any },
      { record, notify },
    );

    expect(notify).not.toHaveBeenCalled();
  });

  it("does nothing for a 4xx", async () => {
    const record = vi.fn();
    await captureNitroError(
      Object.assign(new Error("not found"), { statusCode: 404 }),
      { event: { path: "/api/lobby/create", method: "GET" } as any },
      { record, notify: vi.fn() },
    );
    expect(record).not.toHaveBeenCalled();
  });

  it("does nothing when there is no event at all (a plugin-load error)", async () => {
    const record = vi.fn();
    await captureNitroError(new Error("boom"), { tags: ["plugin"] }, {
      record,
      notify: vi.fn(),
    });
    expect(record).not.toHaveBeenCalled();
  });

  it("does nothing for the issues routes themselves, even at 500", async () => {
    const record = vi.fn();
    await captureNitroError(
      Object.assign(new Error("boom"), { statusCode: 500 }),
      { event: { path: "/api/issues/report", method: "POST" } as any },
      { record, notify: vi.fn() },
    );
    expect(record).not.toHaveBeenCalled();
  });

  // The single most important test in this file. This hook runs inside
  // Nitro's own error-handling chain; a throw from an error handler risks
  // recursion, not just a lost report.
  it("never throws when record() itself throws", async () => {
    const record = vi.fn().mockRejectedValue(new Error("DB is down too"));
    await expect(
      captureNitroError(
        Object.assign(new Error("boom"), { statusCode: 500 }),
        { event: { path: "/api/lobby/create", method: "POST" } as any },
        { record, notify: vi.fn() },
      ),
    ).resolves.toBeUndefined();
  });

  it("never throws when notify() itself rejects", async () => {
    const record = vi.fn().mockResolvedValue(okResult);
    const notify = vi.fn().mockRejectedValue(new Error("discord down"));
    await expect(
      captureNitroError(
        Object.assign(new Error("boom"), { statusCode: 500 }),
        { event: { path: "/api/lobby/create", method: "POST" } as any },
        { record, notify },
      ),
    ).resolves.toBeUndefined();
  });
});
