// Proves the wiring, not the logic: captureNitroError's decision-making
// (should this fire? what payload?) is already covered pure in
// tests/server/issueNitroErrors.test.ts with injected record/notify. This
// file asserts that with its REAL default record/notify — no injection —
// it actually persists a row via the same normalize/record/notify pipeline
// POST /api/issues/report uses.

import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import { captureNitroError } from "~/server/utils/issueNitroErrors";

const db = useDb();

function fakeEvent(path: string, method = "POST") {
  return { path, method } as any;
}

beforeEach(async () => {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
  // setup.ts stubs defineEventHandler/createError only.
  // @ts-ignore
  globalThis.useRuntimeConfig = () => ({ public: { appVersion: "3.19.0" } });
  // @ts-ignore
  globalThis.issueWebhookUrl = undefined;
});

describe("captureNitroError against the real store", () => {
  it("persists a genuine 500 as an api-error group with the request's route/method/status", async () => {
    await captureNitroError(
      Object.assign(new Error("DB connection reset"), { statusCode: 500 }),
      { event: fakeEvent("/api/lobby/create", "POST"), tags: ["request"] },
    );

    const [group] = await db.select().from(issueGroups);
    expect(group).toBeTruthy();
    expect(group!.kind).toBe("api-error");
    expect(group!.title).toBe("DB connection reset");

    const [event] = await db.select().from(issueEvents).where(
      eq(issueEvents.groupId, group!.id),
    );
    expect(event!.route).toBe("/api/lobby/create");
    expect(event!.platform).toBe("server");
    expect(event!.context).toMatchObject({ method: "POST", statusCode: 500 });
  });

  it("groups two different lobby codes hitting the same route as one problem", async () => {
    await captureNitroError(
      Object.assign(new Error("timeout A"), { statusCode: 500 }),
      { event: fakeEvent("/api/lobby/AB2C/leave", "POST") },
    );
    await captureNitroError(
      Object.assign(new Error("timeout B"), { statusCode: 500 }),
      { event: fakeEvent("/api/lobby/XY9Z/leave", "POST") },
    );

    const groups = await db.select().from(issueGroups);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.eventCount).toBe(2);
  });

  it("writes nothing for a 4xx", async () => {
    await captureNitroError(
      Object.assign(new Error("not found"), { statusCode: 404 }),
      { event: fakeEvent("/api/lobby/create", "GET") },
    );
    expect(await db.select().from(issueGroups)).toHaveLength(0);
  });

  it("writes nothing when reporting on the issues route itself, even at 500", async () => {
    await captureNitroError(
      Object.assign(new Error("boom"), { statusCode: 500 }),
      { event: fakeEvent("/api/issues/report", "POST") },
    );
    expect(await db.select().from(issueGroups)).toHaveLength(0);
  });

  it("never throws even against the real store when useRuntimeConfig is unavailable", async () => {
    // @ts-ignore — simulates the hook firing somewhere useRuntimeConfig
    // cannot resolve; must degrade to nothing captured, not a crash.
    delete globalThis.useRuntimeConfig;
    await expect(
      captureNitroError(
        Object.assign(new Error("boom"), { statusCode: 500 }),
        { event: fakeEvent("/api/lobby/create", "POST") },
      ),
    ).resolves.toBeUndefined();
    expect(await db.select().from(issueGroups)).toHaveLength(0);
  });
});
