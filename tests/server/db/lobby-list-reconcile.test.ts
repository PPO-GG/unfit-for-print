import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
let hostId: string;

function mockEvent(query: Record<string, string> = {}) {
  globalThis.getQuery = () => query;
  return {} as any;
}

/** Answers the Teleportal /lobbies/summary call the route makes. */
function stubTeleportal(lobbySummaries: unknown[] | Error) {
  globalThis.$fetch = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith("/lobbies/summary")) {
      if (lobbySummaries instanceof Error) throw lobbySummaries;
      return { lobbies: lobbySummaries, timestamp: Date.now() };
    }
    return {};
  }) as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  const [host] = await db.insert(users).values({ name: "Host" }).returning();
  hostId = host.id;
  globalThis.useRuntimeConfig = () => ({
    public: { lobbyTeleportalUrl: "ws://localhost:1235" },
  });
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  vi.restoreAllMocks();
});

describe("GET /api/lobby/list — reconciliation against live docs", () => {
  it("drops a lobby the live doc says is complete", async () => {
    // The classic drift: the host closed their tab, so the client-side
    // watcher never wrote "complete" back to Postgres.
    const [lobby] = await db
      .insert(lobbies)
      .values({ code: "GHOST", hostUserId: hostId, status: "playing" })
      .returning();
    stubTeleportal([{ code: "GHOST", status: "complete" }]);

    const handler = (await import("~/server/api/lobby/list.get")).default;
    const result = await handler(mockEvent());

    expect(result.map((l: any) => l.code)).not.toContain("GHOST");
    const [row] = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));
    expect(row.status).toBe("complete");
  });

  it("returns the lobby name the host set mid-game", async () => {
    await db
      .insert(lobbies)
      .values({
        code: "NAMED",
        hostUserId: hostId,
        status: "waiting",
        lobbyName: "Stale name",
      })
      .returning();
    stubTeleportal([
      { code: "NAMED", status: "waiting", lobbyName: "Fresh name" },
    ]);

    const handler = (await import("~/server/api/lobby/list.get")).default;
    const result = await handler(mockEvent());

    expect(result.find((l: any) => l.code === "NAMED").lobbyName).toBe(
      "Fresh name",
    );
  });

  it("hides a lobby switched to private in the doc", async () => {
    await db
      .insert(lobbies)
      .values({ code: "PRIV", hostUserId: hostId, status: "waiting", isPrivate: false })
      .returning();
    stubTeleportal([{ code: "PRIV", status: "waiting", isPrivate: true }]);

    const handler = (await import("~/server/api/lobby/list.get")).default;
    const result = await handler(mockEvent());

    expect(result.map((l: any) => l.code)).not.toContain("PRIV");
  });

  it("still answers when Teleportal is unreachable", async () => {
    await db
      .insert(lobbies)
      .values({ code: "OPEN", hostUserId: hostId, status: "waiting" })
      .returning();
    stubTeleportal(new Error("Connection refused"));

    const handler = (await import("~/server/api/lobby/list.get")).default;
    const result = await handler(mockEvent());

    // Fail open: a browser that shows slightly stale lobbies beats one that
    // shows an error because a side service is down.
    expect(result.map((l: any) => l.code)).toContain("OPEN");
  });

  it("leaves a lobby alone when no live doc reports on it", async () => {
    await db
      .insert(lobbies)
      .values({ code: "QUIET", hostUserId: hostId, status: "waiting" })
      .returning();
    stubTeleportal([]);

    const handler = (await import("~/server/api/lobby/list.get")).default;
    const result = await handler(mockEvent());

    expect(result.map((l: any) => l.code)).toContain("QUIET");
  });
});
