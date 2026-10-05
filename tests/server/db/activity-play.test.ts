import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";

const db = useDb();
const INSTANCE = "i-12345";

// The guest guard has its own suite (lobby-guards.test.ts); here the caller is
// whoever the fake event names.
vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return {
    ...actual,
    requireNonGuest: async (event: { userId: string }) => event.userId,
  };
});

// Lets a test hold each press between its lobby lookup and its insert, so two
// presses deterministically overlap there — the window the lock has to close.
const insertDelay = vi.hoisted(() => ({ ms: 0 }));
vi.mock("~/server/utils/createLobbyRow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/createLobbyRow")>();
  return {
    ...actual,
    createLobbyRow: async (...args: Parameters<typeof actual.createLobbyRow>) => {
      if (insertDelay.ms) await new Promise((r) => setTimeout(r, insertDelay.ms));
      return actual.createLobbyRow(...args);
    },
  };
});

/** Answers the Teleportal /lobbies/summary call; an Error means unreachable. */
function stubTeleportal(lobbySummaries: unknown[] | Error) {
  globalThis.$fetch = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith("/lobbies/summary")) {
      if (lobbySummaries instanceof Error) throw lobbySummaries;
      return { lobbies: lobbySummaries, timestamp: Date.now() };
    }
    return {};
  }) as any;
}

async function play(userId: string, body: unknown) {
  globalThis.readBody = async (e: any) => e.body;
  const handler = (await import("~/server/api/lobby/activity-play.post")).default;
  return handler({ userId, body } as any);
}

async function makeUser(name: string) {
  const [u] = await db.insert(users).values({ name, isGuest: false }).returning();
  return u;
}

/** A lobby for INSTANCE, created `secondsAgo` ago. */
async function seedLobby(
  hostUserId: string,
  code: string,
  { secondsAgo = 120, status = "waiting" as "waiting" | "playing" | "complete" } = {},
) {
  const [lobby] = await db
    .insert(lobbies)
    .values({
      code,
      hostUserId,
      status,
      discordInstanceId: INSTANCE,
      vcOnly: true,
      isPrivate: false,
      createdAt: new Date(Date.now() - secondsAgo * 1000),
    })
    .returning();
  return lobby;
}

const instanceLobbies = () =>
  db.select().from(lobbies).where(eq(lobbies.discordInstanceId, INSTANCE));

let alice: typeof users.$inferSelect;
let bob: typeof users.$inferSelect;

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  alice = await makeUser("Alice");
  bob = await makeUser("Bob");
  globalThis.useRuntimeConfig = () =>
    ({ public: { lobbyTeleportalUrl: "ws://localhost:1235" } }) as any;
  stubTeleportal([]);
  insertDelay.ms = 0;
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  vi.restoreAllMocks();
});

describe("POST /api/lobby/activity-play", () => {
  it("creates the instance's lobby with the caller as host", async () => {
    const res: any = await play(alice.id, { instanceId: INSTANCE, channelId: "c-1" });

    expect(res.created).toBe(true);
    expect(res.lobby).toMatchObject({
      hostUserId: alice.id,
      discordInstanceId: INSTANCE,
      discordChannelId: "c-1",
      lobbyName: "Alice's Game",
      vcOnly: true,
      isPrivate: false,
    });
    const seats = await db.select().from(players).where(eq(players.lobbyId, res.lobby.id));
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ userId: alice.id, isHost: true });
  });

  it("returns a live lobby without seating the caller", async () => {
    const live = await seedLobby(alice.id, "LIVE");
    stubTeleportal([{ code: "LIVE" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res.created).toBe(false);
    expect(res.lobby.id).toBe(live.id);
    expect(await instanceLobbies()).toHaveLength(1);
    // Seating is joinLobby's job (seat cap, spectator clamp).
    const seats = await db.select().from(players).where(eq(players.userId, bob.id));
    expect(seats).toHaveLength(0);
  });

  it("returns the caller's own live lobby", async () => {
    const live = await seedLobby(alice.id, "MINE");
    stubTeleportal([{ code: "MINE" }]);

    const res: any = await play(alice.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: live.id } });
    expect(await instanceLobbies()).toHaveLength(1);
  });

  it("matches codes case-insensitively", async () => {
    const live = await seedLobby(alice.id, "CASE");
    stubTeleportal([{ code: "case" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: live.id } });
  });

  it("gives two simultaneous presses one lobby", async () => {
    insertDelay.ms = 100;
    const [a, b]: any[] = await Promise.all([
      play(alice.id, { instanceId: INSTANCE }),
      play(bob.id, { instanceId: INSTANCE }),
    ]);

    expect(await instanceLobbies()).toHaveLength(1);
    expect([a.created, b.created].sort()).toEqual([false, true]);
    expect(a.lobby.id).toBe(b.lobby.id);
  });

  it("replaces a lobby whose doc is gone", async () => {
    const dead = await seedLobby(alice.id, "DEAD", { secondsAgo: 120 });
    stubTeleportal([]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res.created).toBe(true);
    expect(res.lobby.id).not.toBe(dead.id);
    expect(res.lobby.hostUserId).toBe(bob.id);
    const [old] = await db.select().from(lobbies).where(eq(lobbies.id, dead.id));
    expect(old.status).toBe("complete");
  });

  it("does not replace a lobby still inside its grace window", async () => {
    const fresh = await seedLobby(alice.id, "NEWB", { secondsAgo: 5 });
    stubTeleportal([]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: fresh.id } });
  });

  it("joins a finished game whose doc is still live", async () => {
    // Game over: the engine writes status "complete" to the doc and
    // reconciliation copies it to the row while the group is still on the
    // podium. A late arrival must land with them, not in a new lobby.
    const finished = await seedLobby(alice.id, "OVER", { status: "complete" });
    stubTeleportal([{ code: "OVER", status: "complete" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: finished.id } });
    expect(await instanceLobbies()).toHaveLength(1);
  });

  it("prefers the live lobby over a newer one whose doc is gone", async () => {
    const live = await seedLobby(alice.id, "LIVE", { secondsAgo: 600, status: "complete" });
    await seedLobby(bob.id, "GONE", { secondsAgo: 120 });
    stubTeleportal([{ code: "LIVE" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: live.id } });
  });

  it("replaces a live doc that was never set up", async () => {
    // The creator's client died between the row insert and writing the doc,
    // and someone connected to the empty doc: Teleportal holds it, but it has
    // no meta, so it reports no status. Nobody can ever start that game.
    const broken = await seedLobby(alice.id, "BROK", { secondsAgo: 120 });
    stubTeleportal([{ code: "BROK", players: 1 }, { code: "ELSE", status: "waiting" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res.created).toBe(true);
    const [old] = await db.select().from(lobbies).where(eq(lobbies.id, broken.id));
    expect(old.status).toBe("complete");
  });

  it("leaves a never-set-up doc alone inside its grace window", async () => {
    const fresh = await seedLobby(alice.id, "SOON", { secondsAgo: 5 });
    stubTeleportal([{ code: "SOON", players: 1 }, { code: "ELSE", status: "waiting" }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: fresh.id } });
  });

  it("trusts presence alone from a Teleportal that reports no statuses", async () => {
    // A build from before status was added to the summary: a missing status
    // says nothing about the doc, so it must not read as "never set up".
    const live = await seedLobby(alice.id, "OLDB", { secondsAgo: 120 });
    stubTeleportal([{ code: "OLDB", players: 3 }]);

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: live.id } });
  });

  it("ignores complete lobbies", async () => {
    await seedLobby(alice.id, "DONE", { status: "complete" });

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res.created).toBe(true);
    expect(res.lobby.code).not.toBe("DONE");
  });

  it("joins the existing lobby when Teleportal is unreachable", async () => {
    const live = await seedLobby(alice.id, "DOWN", { secondsAgo: 600 });
    stubTeleportal(new Error("ECONNREFUSED"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res: any = await play(bob.id, { instanceId: INSTANCE });

    expect(res).toMatchObject({ created: false, lobby: { id: live.id } });
  });

  it("rejects a missing instance id", async () => {
    await expect(play(alice.id, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(play(alice.id, { instanceId: "  " })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe("GET /api/lobby/by-instance/:instanceId", () => {
  async function byInstance(instanceId: string) {
    globalThis.getRouterParam = (_e: unknown, name: string) =>
      name === "instanceId" ? instanceId : undefined;
    const handler = (await import("~/server/api/lobby/by-instance/[instanceId].get")).default;
    return handler({} as any);
  }

  it("skips complete lobbies and returns the newest live one", async () => {
    await seedLobby(alice.id, "OLDD", { secondsAgo: 600 });
    await seedLobby(alice.id, "GONE", { secondsAgo: 10, status: "complete" });
    const newest = await seedLobby(bob.id, "NEWW", { secondsAgo: 60 });

    const res: any = await byInstance(INSTANCE);
    expect(res.id).toBe(newest.id);
  });

  it("returns null when only complete lobbies exist", async () => {
    await seedLobby(alice.id, "DONE", { status: "complete" });
    expect(await byInstance(INSTANCE)).toBeNull();
  });
});
