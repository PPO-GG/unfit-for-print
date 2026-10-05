// @vitest-environment node
//
// After a game, the host's client resets the Y.Doc to "waiting", but nothing
// writes the lobby row: it stays "playing" until something reconciles it
// against the live docs. Routes that gate on the row's status refused the host
// a bot ("Can only add bots while waiting") and seated newcomers as spectators
// in a lobby that was back in its waiting room.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";
import { resetUserTables } from "./helpers/users";

const db = useDb();
let hostId: string;
let lobbyId: string;
let sessionUserId: string | null = null;

vi.stubGlobal("getUserSession", async () => ({
  user: sessionUserId ? { id: sessionUserId } : undefined,
}));
vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireHost: async () => hostId };
});

function mockEvent(body: unknown) {
  globalThis.readBody = async () => body;
  return { node: { req: { headers: {} } } } as any;
}

/** Answers Teleportal's /lobbies/summary with the live doc's status. */
function liveStatus(status: string) {
  globalThis.$fetch = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).endsWith("/lobbies/summary")) {
      return { lobbies: [{ code: "RST1", status }], timestamp: Date.now() };
    }
    return {};
  }) as any;
}

beforeEach(async () => {
  sessionUserId = null;
  await resetUserTables();
  globalThis.useRuntimeConfig = () => ({
    public: { lobbyTeleportalUrl: "ws://localhost:1235" },
  });
  const [host] = await db
    .insert(users)
    .values({ name: "Host", isGuest: false, discordUserId: "d-rst" })
    .returning();
  hostId = host!.id;
  const [lobby] = await db
    .insert(lobbies)
    .values({ code: "RST1", hostUserId: hostId, status: "playing" })
    .returning();
  lobbyId = lobby!.id;
  await db.insert(players).values({ userId: hostId, lobbyId, name: "Host", isHost: true });
});

afterEach(async () => {
  await resetUserTables();
  vi.restoreAllMocks();
});

describe("lobby status after the host resets a finished game", () => {
  it("lets the host add a bot once the live doc is back to waiting", async () => {
    liveStatus("waiting");
    const handler = (await import("~/server/api/bot/add.post")).default;
    const result: any = await handler(mockEvent({ lobbyId }));
    expect(result.success).toBe(true);
    const [row] = await db.select().from(lobbies).where(eq(lobbies.id, lobbyId));
    expect(row!.status).toBe("waiting");
  });

  it("still refuses a bot while the game is really running", async () => {
    liveStatus("playing");
    const handler = (await import("~/server/api/bot/add.post")).default;
    await expect(handler(mockEvent({ lobbyId }))).rejects.toThrow(
      "Can only add bots while waiting",
    );
  });

  it("seats a newcomer as a player once the live doc is back to waiting", async () => {
    liveStatus("waiting");
    const [u] = await db.insert(users).values({ name: "New", isGuest: true }).returning();
    sessionUserId = u!.id;
    const handler = (await import("~/server/api/lobby/join.post")).default;
    const result: any = await handler(mockEvent({ code: "RST1", playerName: "New" }));
    expect(result.player.playerType).toBe("player");
  });

  it("still seats a mid-game newcomer as a spectator", async () => {
    liveStatus("playing");
    const [u] = await db.insert(users).values({ name: "Late", isGuest: true }).returning();
    sessionUserId = u!.id;
    const handler = (await import("~/server/api/lobby/join.post")).default;
    const result: any = await handler(mockEvent({ code: "RST1", playerName: "Late" }));
    expect(result.player.playerType).toBe("spectator");
  });
});

describe("POST /api/lobby/reset", () => {
  it("puts the lobby row back to waiting for the host", async () => {
    const handler = (await import("~/server/api/lobby/reset.post")).default;
    const result: any = await handler(mockEvent({ lobbyId }));
    expect(result.success).toBe(true);
    const [row] = await db.select().from(lobbies).where(eq(lobbies.id, lobbyId));
    expect(row!.status).toBe("waiting");
  });

  it("requires a lobby id", async () => {
    const handler = (await import("~/server/api/lobby/reset.post")).default;
    await expect(handler(mockEvent({}))).rejects.toThrow("lobbyId is required");
  });
});
