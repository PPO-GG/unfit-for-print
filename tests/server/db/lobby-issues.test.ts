import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useDb } from "~/server/db/client";
import { issueEvents, issueGroups } from "~/server/db/schema";
import { openIssuesByLobby } from "~/server/utils/lobbyIssues";

const db = useDb();

async function clean() {
  await db.delete(issueEvents);
  await db.delete(issueGroups);
}

async function group(title: string, status: "open" | "resolved" = "open", kind: "anomaly" | "client-error" = "anomaly") {
  const [g] = await db
    .insert(issueGroups)
    .values({ fingerprint: `fp-${title}`, kind, title, status })
    .returning();
  return g!.id;
}

async function event(groupId: string, lobbyCode: string | null, minutesAgo = 1) {
  await db.insert(issueEvents).values({
    groupId,
    message: "m",
    lobbyCode,
    appVersion: "1.0.0",
    createdAt: new Date(Date.now() - minutesAgo * 60_000),
  });
}

beforeEach(clean);
afterEach(clean);

describe("openIssuesByLobby", () => {
  it("lists open groups with a recent event per lobby code", async () => {
    const stuck = await group("judge-missing");
    const noisy = await group("TypeError", "open", "client-error");
    const fixed = await group("old", "resolved");
    await event(stuck, "AB12");
    await event(stuck, "AB12");
    await event(noisy, "AB12");
    await event(fixed, "AB12");
    await event(stuck, "ZZ99", 45); // outside the 30 min window
    await event(stuck, "CD34");

    const result = await openIssuesByLobby(db, ["AB12", "ZZ99"]);
    expect(Object.keys(result)).toEqual(["AB12"]);
    expect(result.AB12!.sort((a, b) => a.kind.localeCompare(b.kind))).toEqual([
      { groupId: stuck, title: "judge-missing", kind: "anomaly", eventCount: 2 },
      { groupId: noisy, title: "TypeError", kind: "client-error", eventCount: 1 },
    ]);
  });

  it("returns nothing for no codes without querying", async () => {
    expect(await openIssuesByLobby(db, [])).toEqual({});
  });

  it("fails open when the query throws", async () => {
    const broken = { select: () => { throw new Error("db down"); } } as any;
    expect(await openIssuesByLobby(broken, ["AB12"])).toEqual({});
  });
});
