// @vitest-environment node
//
// Lobby join passwords.
//
// Before this, the password was written as PLAINTEXT into the Y.Doc settings
// map, broadcast to every client in the lobby, and never checked by anything —
// the join prompt that would have asked for it did not exist. A lobby showing
// "Require password to join" was joinable by anyone holding the 4-character
// code, with no challenge at all.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, lobbyPasswords, players, users } from "~/server/db/schema";

const db = useDb();

let mockSessionUserId: string | null = null;
vi.stubGlobal("getUserSession", async () => ({
  user: mockSessionUserId ? { id: mockSessionUserId } : undefined,
}));

function mockEvent(body: unknown, params: Record<string, string> = {}) {
  globalThis.readBody = async () => body;
  globalThis.getRouterParam = (_e: unknown, name: string) => params[name];
  globalThis.getQuery = () => params;
  return { node: { req: { headers: {} } } } as any;
}

const setPassword = async () =>
  (await import("~/server/api/lobby/password.post")).default;
const joinHandler = async () =>
  (await import("~/server/api/lobby/join.post")).default;
const byCode = async () =>
  (await import("~/server/api/lobby/by-code/[code].get")).default;

let hostId: string;
let joinerId: string;
let lobbyId: string;

beforeEach(async () => {
  mockSessionUserId = null;
  await db.delete(lobbyPasswords);
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);

  const [host] = await db
    .insert(users)
    .values({ name: "Host", isGuest: false, discordUserId: "d-host" })
    .returning();
  const [joiner] = await db
    .insert(users)
    .values({ name: "Joiner", isGuest: true })
    .returning();
  hostId = host!.id;
  joinerId = joiner!.id;

  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "PWD1", hostUserId: hostId, status: "waiting" })
    .returning();
  lobbyId = lobby!.id;

  await db.insert(players).values({
    userId: hostId,
    lobbyId,
    name: "Host",
    isHost: true,
    playerType: "player",
  });
});

const readStored = async () => {
  const [row] = await db
    .select()
    .from(lobbyPasswords)
    .where(eq(lobbyPasswords.lobbyId, lobbyId));
  return row;
};

describe("POST /api/lobby/password", () => {
  it("lets the host set a password, stored hashed rather than in the clear", async () => {
    mockSessionUserId = hostId;

    await (await setPassword())(
      mockEvent({ lobbyId, password: "hunter2" }),
    );

    const row = await readStored();
    expect(row).toBeDefined();
    expect(row!.hash).not.toBe("hunter2");
    expect(row!.hash).not.toContain("hunter2");
    expect(row!.hash.startsWith("$scrypt$")).toBe(true);
  });

  it("replaces an existing password rather than adding a second row", async () => {
    mockSessionUserId = hostId;
    const set = await setPassword();

    await set(mockEvent({ lobbyId, password: "first" }));
    const first = (await readStored())!.hash;
    await set(mockEvent({ lobbyId, password: "second" }));

    const rows = await db.select().from(lobbyPasswords);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hash).not.toBe(first);
  });

  it("clears the password when given an empty string", async () => {
    mockSessionUserId = hostId;
    const set = await setPassword();

    await set(mockEvent({ lobbyId, password: "hunter2" }));
    await set(mockEvent({ lobbyId, password: "" }));

    expect(await readStored()).toBeUndefined();
  });

  it("refuses a caller who is not the host", async () => {
    mockSessionUserId = joinerId;

    await expect(
      (await setPassword())(mockEvent({ lobbyId, password: "hunter2" })),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await readStored()).toBeUndefined();
  });
});

describe("POST /api/lobby/join — password challenge", () => {
  const protect = async (password: string) => {
    mockSessionUserId = hostId;
    await (await setPassword())(mockEvent({ lobbyId, password }));
    mockSessionUserId = joinerId;
  };

  it("joins freely when the lobby has no password", async () => {
    mockSessionUserId = joinerId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "PWD1", playerName: "Joiner" }),
    );

    expect(player.userId).toBe(joinerId);
  });

  it("refuses a join with no password when one is required", async () => {
    await protect("hunter2");

    await expect(
      (await joinHandler())(mockEvent({ code: "PWD1", playerName: "Joiner" })),
    ).rejects.toMatchObject({ statusCode: 403 });

    const rows = await db
      .select()
      .from(players)
      .where(eq(players.userId, joinerId));
    expect(rows).toHaveLength(0);
  });

  it("refuses a join with the wrong password", async () => {
    await protect("hunter2");

    await expect(
      (await joinHandler())(
        mockEvent({ code: "PWD1", playerName: "Joiner", password: "wrong" }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("admits a join with the correct password", async () => {
    await protect("hunter2");

    const { player } = await (await joinHandler())(
      mockEvent({ code: "PWD1", playerName: "Joiner", password: "hunter2" }),
    );

    expect(player.userId).toBe(joinerId);
    expect(player.playerType).toBe("player");
  });

  // Someone already seated must not be locked out of their own game by a
  // password the host set after they joined.
  it("lets an existing player back in without the password", async () => {
    await protect("hunter2");
    mockSessionUserId = hostId;

    const { player } = await (await joinHandler())(
      mockEvent({ code: "PWD1", playerName: "Host" }),
    );

    expect(player.isHost).toBe(true);
  });
});

describe("GET /api/lobby/by-code/[code]", () => {
  it("reports that a password is required without revealing anything about it", async () => {
    mockSessionUserId = hostId;
    await (await setPassword())(mockEvent({ lobbyId, password: "hunter2" }));

    const res: any = await (await byCode())(mockEvent({}, { code: "PWD1" }));

    expect(res.hasPassword).toBe(true);
    expect(JSON.stringify(res)).not.toContain("hunter2");
    expect(JSON.stringify(res)).not.toContain("$scrypt$");
    expect(res.hash).toBeUndefined();
    expect(res.passwordHash).toBeUndefined();
  });

  it("reports no password for an open lobby", async () => {
    const res: any = await (await byCode())(mockEvent({}, { code: "PWD1" }));
    expect(res.hasPassword).toBe(false);
  });
});
