import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { users, lobbies, players } from "~/server/db/schema";
import { pruneStaleLobbies } from "~/server/utils/pruneLobbies";

const db = useDb();

vi.mock("~/server/utils/session", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/server/utils/session")>();
  return { ...actual, requireAdmin: async () => "admin-id" };
});

function mockEvent(body?: unknown) {
  globalThis.readBody = async () => body;
  return {} as any;
}

beforeEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
  vi.restoreAllMocks();
});

afterEach(async () => {
  await db.delete(players);
  await db.delete(lobbies);
  await db.delete(users);
});

describe("pruneStaleLobbies", () => {
  it("prunes orphaned lobbies older than 2 hours and preserves live or young lobbies", async () => {
    // Mock Teleportal status returning live doc for 'LIVE'
    globalThis.$fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/status")) {
        return {
          documents: {
            "lobby/lobby-LIVE": { clients: 2, idleSec: 0 },
          },
        };
      }
      return {};
    }) as any;

    const [host] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    // 1. Old orphaned lobby (> 2h, no Teleportal doc) -> should be pruned
    const [oldOrphan] = await db
      .insert(lobbies)
      .values({ code: "ORPH", hostUserId: host.id, status: "waiting", createdAt: threeHoursAgo })
      .returning();

    // 2. Young orphaned lobby (< 2h, no Teleportal doc) -> should be kept
    const [youngOrphan] = await db
      .insert(lobbies)
      .values({ code: "YUNG", hostUserId: host.id, status: "waiting", createdAt: thirtyMinsAgo })
      .returning();

    // 3. Old live lobby (> 2h, but active in Teleportal) -> should be kept
    const [liveLobby] = await db
      .insert(lobbies)
      .values({ code: "LIVE", hostUserId: host.id, status: "playing", createdAt: threeHoursAgo })
      .returning();

    const result = await pruneStaleLobbies();
    expect(result.success).toBe(true);
    expect(result.prunedCount).toBe(1);
    expect(result.orphanedCount).toBe(1);

    const remainingLobbies = await db.select().from(lobbies);
    const remainingCodes = remainingLobbies.map((l) => l.code);

    expect(remainingCodes).toContain("YUNG");
    expect(remainingCodes).toContain("LIVE");
    expect(remainingCodes).not.toContain("ORPH");
  });

  it("prunes completed lobbies older than 24 hours", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ documents: {} }) as any;

    const [host] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    // Old completed lobby (> 24h) -> should be pruned
    const [oldCompleted] = await db
      .insert(lobbies)
      .values({ code: "DONE", hostUserId: host.id, status: "complete", createdAt: twoDaysAgo })
      .returning();

    // Recent completed lobby (< 24h) -> should be kept
    const [recentCompleted] = await db
      .insert(lobbies)
      .values({ code: "RECN", hostUserId: host.id, status: "complete", createdAt: twoHoursAgo })
      .returning();

    const result = await pruneStaleLobbies();
    expect(result.completedCount).toBe(1);

    const remainingLobbies = await db.select().from(lobbies);
    const remainingCodes = remainingLobbies.map((l) => l.code);

    expect(remainingCodes).toContain("RECN");
    expect(remainingCodes).not.toContain("DONE");
  });

  it("cleans up synthetic bot users when pruning lobbies", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ documents: {} }) as any;

    const [host] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const [botUser] = await db
      .insert(users)
      .values({ name: "Bot1", isGuest: true })
      .returning();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const [oldLobby] = await db
      .insert(lobbies)
      .values({ code: "BOTS", hostUserId: host.id, createdAt: threeHoursAgo })
      .returning();

    await db.insert(players).values([
      { userId: host.id, lobbyId: oldLobby.id, name: "Host", isHost: true },
      { userId: botUser.id, lobbyId: oldLobby.id, name: "Bot1", playerType: "bot" },
    ]);

    await pruneStaleLobbies();

    // Verify bot synthetic user was deleted
    const remainingBotUser = await db.select().from(users).where(eq(users.id, botUser.id));
    expect(remainingBotUser).toHaveLength(0);

    // Verify host real user survived
    const remainingHost = await db.select().from(users).where(eq(users.id, host.id));
    expect(remainingHost).toHaveLength(1);
  });

  it("cleans up ephemeral human guest users and orphaned guest users", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ documents: {} }) as any;

    const [registeredHost] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const [guestPlayer] = await db
      .insert(users)
      .values({ name: "Guest1", isGuest: true })
      .returning();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Orphaned guest with no lobby older than 15 mins
    const [strandedGuest] = await db
      .insert(users)
      .values({ name: "Stranded", isGuest: true, createdAt: thirtyMinsAgo })
      .returning();

    const [oldLobby] = await db
      .insert(lobbies)
      .values({ code: "GSTS", hostUserId: registeredHost.id, createdAt: threeHoursAgo })
      .returning();

    await db.insert(players).values([
      { userId: registeredHost.id, lobbyId: oldLobby.id, name: "Host", isHost: true },
      { userId: guestPlayer.id, lobbyId: oldLobby.id, name: "Guest1", playerType: "player" },
    ]);

    await pruneStaleLobbies();

    // Verify guest user in pruned lobby was deleted
    const remainingGuest = await db.select().from(users).where(eq(users.id, guestPlayer.id));
    expect(remainingGuest).toHaveLength(0);

    // Verify stranded guest older than threshold was pruned
    const remainingStranded = await db.select().from(users).where(eq(users.id, strandedGuest.id));
    expect(remainingStranded).toHaveLength(0);

    // Verify registered user survived
    const remainingHost = await db.select().from(users).where(eq(users.id, registeredHost.id));
    expect(remainingHost).toHaveLength(1);
  });

  it("safely skips orphan pruning when Teleportal is offline unless forceAllOrphans is set", async () => {
    // Teleportal unreachable
    globalThis.$fetch = vi.fn().mockRejectedValue(new Error("Connection refused")) as any;

    const [host] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    await db
      .insert(lobbies)
      .values({ code: "OFFL", hostUserId: host.id, createdAt: threeHoursAgo });

    // Without force, should NOT prune orphans defensively
    const safeResult = await pruneStaleLobbies();
    expect(safeResult.prunedCount).toBe(0);
    expect(safeResult.teleportalOnline).toBe(false);

    let remaining = await db.select().from(lobbies);
    expect(remaining).toHaveLength(1);

    // With forceAllOrphans, admin explicitly overrides
    const forceResult = await pruneStaleLobbies({ forceAllOrphans: true });
    expect(forceResult.prunedCount).toBe(1);

    remaining = await db.select().from(lobbies);
    expect(remaining).toHaveLength(0);
  });
});

describe("POST /api/admin/lobby/prune", () => {
  it("calls pruneStaleLobbies and returns stats", async () => {
    globalThis.$fetch = vi.fn().mockResolvedValue({ documents: {} }) as any;

    const [host] = await db
      .insert(users)
      .values({ name: "Host", isGuest: false })
      .returning();

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    await db
      .insert(lobbies)
      .values({ code: "PRUN", hostUserId: host.id, createdAt: threeHoursAgo });

    const handler = (await import("~/server/api/admin/lobby/prune.post")).default;
    const result = await handler(mockEvent({ forceAllOrphans: false }));

    expect(result.success).toBe(true);
    expect(result.prunedCount).toBe(1);
  });
});
