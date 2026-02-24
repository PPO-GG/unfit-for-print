/**
 * Integration test: Full gameplay flow
 *
 * Tests the complete game lifecycle through the Nitro API routes:
 *   1. Setup: Create a lobby + 3 players in Appwrite
 *   2. Start Game: POST /api/game/start
 *   3. Play Cards: POST /api/game/play-card (for each non-judge player)
 *   4. Select Winner: POST /api/game/select-winner
 *   5. Next Round: POST /api/game/next-round
 *   6. Cleanup: Delete test data from Appwrite
 *
 * Prerequisites:
 *   - `pnpm dev` running on localhost:3000
 *   - Appwrite available with valid credentials in .env
 *   - At least some white and black cards seeded in the database
 *
 * Run: pnpm test:gameplay
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client, Databases, Query, ID } from "node-appwrite";
import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

// ─── Config ──────────────────────────────────────────────────────────

dotenvConfig({ path: resolve(__dirname, "../../.env") });

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";

const APPWRITE_ENDPOINT = process.env.NUXT_PUBLIC_APPWRITE_ENDPOINT!;
const APPWRITE_PROJECT = process.env.NUXT_PUBLIC_APPWRITE_PROJECT_ID!;
const APPWRITE_API_KEY = process.env.NUXT_APPWRITE_API_KEY!;

const DB = process.env.NUXT_PUBLIC_APPWRITE_DATABASE_ID!;
const LOBBY_COL = process.env.NUXT_PUBLIC_APPWRITE_LOBBY_COLLECTION_ID!;
const PLAYER_COL = process.env.NUXT_PUBLIC_APPWRITE_PLAYER_COLLECTION_ID!;
const GAMECARDS_COL = process.env.NUXT_PUBLIC_APPWRITE_GAMECARDS_COLLECTION_ID!;
const GAMESETTINGS_COL =
  process.env.NUXT_PUBLIC_APPWRITE_GAMESETTINGS_COLLECTION_ID!;

// ─── Test Data ───────────────────────────────────────────────────────

const TEST_PLAYERS = [
  { userId: "test-player-1", name: "Alice" },
  { userId: "test-player-2", name: "Bob" },
  { userId: "test-player-3", name: "Charlie" },
];

// Track created documents for cleanup
const createdDocs: { collection: string; id: string }[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────

let databases: Databases;

function setupAdmin() {
  const client = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)
    .setProject(APPWRITE_PROJECT)
    .setKey(APPWRITE_API_KEY);
  databases = new TablesDB(client);
  const databases = new Databases(client);
  const tables = new (await import("node-appwrite")).TablesDB(client);
}

async function callApi(path: string, body: Record<string, any>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} failed (${res.status}): ${text}`);
  }

  return res.json();
}

async function getLobbyState(lobbyId: string) {
  const lobby = await tables.getRow({ databaseId: DB, tableId: LOBBY_COL, rowId: lobbyId });
  return {
    status: lobby.status,
    gameState: lobby.gameState ? JSON.parse(lobby.gameState as string) : null,
  };
}

async function getGameCards(lobbyId: string) {
  const res = await tables.listRows({ databaseId: DB, tableId: GAMECARDS_COL, queries: [
          Query.equal("lobbyId", lobbyId),
        ] });
  if (res.rows.length === 0) return null;
  const doc = res.rows[0]!;

  // Parse player hands
  const hands: Record<string, string[]> = {};
  for (const handStr of doc.playerHands as string[]) {
    const parsed = JSON.parse(handStr);
    hands[parsed.playerId] = parsed.cards;
  }

  return {
    $id: doc.$id,
    whiteDeck: doc.whiteDeck as string[],
    blackDeck: doc.blackDeck as string[],
    discardWhite: doc.discardWhite as string[],
    discardBlack: doc.discardBlack as string[],
    hands,
  };
}

function track(collection: string, id: string) {
  createdDocs.push({ collection, id });
}

// ─── Test Suite ──────────────────────────────────────────────────────

describe("Gameplay Integration Test", () => {
  let lobbyId: string;
  let settingsId: string;

  beforeAll(async () => {
    setupAdmin();

    // --- Create test lobby ---
    const lobbyCode = `TST${Date.now().toString(36).slice(-3).toUpperCase()}`;
    const lobby = await tables.createRow({ databaseId: DB, tableId: LOBBY_COL, rowId: ID.unique(), data: {
              code: lobbyCode,
              hostUserId: TEST_PLAYERS[0]!.userId,
              status: "waiting",
              round: 0,
              gameState: JSON.stringify({
                phase: "waiting",
                round: 0,
                scores: {},
                hands: {},
                playedCards: {},
                submissions: {},
                blackCard: null,
                judgeId: null,
                roundWinner: null,
                roundEndStartTime: null,
                returnedToLobby: {},
                gameEndTime: null,
              }),
            } });
    lobbyId = lobby.$id;
    track(LOBBY_COL, lobbyId);
    console.log(`  ✓ Created test lobby: ${lobbyCode} (${lobbyId})`);

    // --- Create game settings ---
    const settings = await tables.createRow({ databaseId: DB, tableId: GAMESETTINGS_COL, rowId: ID.unique(), data: {
                lobbyId,
                maxPoints: 3,
                numPlayerCards: 5,
                cardPacks: [],
                isPrivate: false,
                lobbyName: "Integration Test Game",
              } });
    settingsId = settings.$id;
    track(GAMESETTINGS_COL, settingsId);
    console.log(`  ✓ Created game settings: ${settingsId}`);

    // --- Create 3 test players ---
    for (let i = 0; i < TEST_PLAYERS.length; i++) {
      const player = TEST_PLAYERS[i]!;
      const doc = await tables.createRow({ databaseId: DB, tableId: PLAYER_COL, rowId: ID.unique(), data: {
                  lobbyId,
                  userId: player.userId,
                  name: player.name,
                  avatar: "",
                  isHost: i === 0,
                  joinedAt: new Date().toISOString(),
                  provider: "test",
                  playerType: "player",
                } });
      track(PLAYER_COL, doc.$id);
      console.log(`  ✓ Created player: ${player.name} (${doc.$id})`);
    }
  });

  afterAll(async () => {
    console.log("\n  Cleaning up test data...");

    // Also clean up gamecards created during the game
    try {
      const gameCards = await tables.listRows({ databaseId: DB, tableId: GAMECARDS_COL, queries: [
                  Query.equal("lobbyId", lobbyId),
                ] });
      for (const doc of gameCards.rows) {
        await tables.deleteRow({ databaseId: DB, tableId: GAMECARDS_COL, rowId: doc.$id });
        console.log(`  ✓ Deleted gamecards: ${doc.$id}`);
      }
    } catch {
      /* ignore */
    }

    // Delete tracked documents in reverse order
    for (const { collection, id } of createdDocs.reverse()) {
      try {
        await tables.deleteRow({ databaseId: DB, tableId: collection, rowId: id });
        console.log(`  ✓ Deleted ${collection}: ${id}`);
      } catch {
        console.log(
          `  ⚠ Could not delete ${collection}: ${id} (may already be gone)`,
        );
      }
    }
  });

  // ─── Step 1: Start Game ──────────────────────────────────────

  it("Step 1: Start game → creates gamecards, sets phase to submitting", async () => {
    const result = await callApi("/api/game/start", {
      lobbyId,
      documentId: settingsId,
      settings: {
        maxPoints: 3,
        numPlayerCards: 5,
        cardPacks: [],
        isPrivate: false,
        lobbyName: "Integration Test Game",
      },
    });

    expect(result.success).toBe(true);

    // Verify lobby status updated
    const { status, gameState } = await getLobbyState(lobbyId);
    expect(status).toBe("playing");
    expect(gameState).toBeTruthy();
    expect(gameState.phase).toBe("submitting");
    expect(gameState.round).toBe(1);
    expect(gameState.judgeId).toBe(TEST_PLAYERS[0]!.userId); // host is first judge
    expect(gameState.blackCard).toBeTruthy();
    expect(gameState.blackCard.text).toBeTruthy();
    expect(gameState.blackCard.pick).toBeGreaterThanOrEqual(1);
    expect(Object.keys(gameState.scores)).toHaveLength(3);

    // Verify gamecards created with hands
    const gameCards = await getGameCards(lobbyId);
    expect(gameCards).toBeTruthy();
    expect(Object.keys(gameCards!.hands)).toHaveLength(3);

    // Each player should have 5 cards (numPlayerCards from settings)
    for (const player of TEST_PLAYERS) {
      const hand = gameCards!.hands[player.userId];
      expect(hand).toBeDefined();
      expect(hand!.length).toBe(5);
    }

    // White deck should have extra cards
    expect(gameCards!.whiteDeck.length).toBeGreaterThan(0);

    console.log(`    Judge: ${gameState.judgeId}`);
    console.log(
      `    Black card: "${gameState.blackCard.text}" (pick ${gameState.blackCard.pick})`,
    );
    console.log(
      `    Hands dealt: ${Object.entries(gameCards!.hands)
        .map(([id, cards]) => `${id}: ${(cards as string[]).length} cards`)
        .join(", ")}`,
    );
  }, 30000);

  // ─── Step 2: Play Cards ──────────────────────────────────────

  it("Step 2: Non-judge players submit cards → phase transitions to judging", async () => {
    const { gameState } = await getLobbyState(lobbyId);
    const judgeId = gameState.judgeId;
    const gameCards = await getGameCards(lobbyId);
    expect(gameCards).toBeTruthy();

    const nonJudgePlayers = TEST_PLAYERS.filter((p) => p.userId !== judgeId);
    const pick = gameState.blackCard.pick || 1;

    // Submit cards for each non-judge player
    for (const player of nonJudgePlayers) {
      const hand = gameCards!.hands[player.userId]!;
      const cardsToPlay = hand.slice(0, pick);
      expect(cardsToPlay).toHaveLength(pick);

      const result = await callApi("/api/game/play-card", {
        lobbyId,
        playerId: player.userId,
        cardIds: cardsToPlay,
      });

      expect(result.success).toBe(true);
      console.log(
        `    ${player.name} played ${pick} card(s): [${cardsToPlay.join(", ")}]`,
      );
    }

    // After all non-judges submit, phase should be 'judging'
    const updated = await getLobbyState(lobbyId);
    expect(updated.gameState.phase).toBe("judging");
    expect(Object.keys(updated.gameState.submissions)).toHaveLength(
      nonJudgePlayers.length,
    );

    // Verify cards were removed from hands
    const updatedCards = await getGameCards(lobbyId);
    for (const player of nonJudgePlayers) {
      const handSize = updatedCards!.hands[player.userId]!.length;
      expect(handSize).toBe(5 - pick); // 5 cards minus what was played
    }

    console.log(`    Phase transitioned to: judging`);
    console.log(
      `    Submissions: ${Object.keys(updated.gameState.submissions).length}`,
    );
  }, 30000);

  // ─── Step 2b: Validation checks ─────────────────────────────

  it("Step 2b: Judge cannot play, duplicate submissions rejected", async () => {
    const { gameState } = await getLobbyState(lobbyId);
    const judgeId = gameState.judgeId;
    const gameCards = await getGameCards(lobbyId);

    // Judge trying to play → should fail
    const judgeHand = gameCards!.hands[judgeId]!;
    await expect(
      callApi("/api/game/play-card", {
        lobbyId,
        playerId: judgeId,
        cardIds: [judgeHand[0]],
      }),
    ).rejects.toThrow();

    // Already-submitted player trying again → should fail
    const alreadySubmitted = TEST_PLAYERS.find((p) => p.userId !== judgeId)!;
    await expect(
      callApi("/api/game/play-card", {
        lobbyId,
        playerId: alreadySubmitted.userId,
        cardIds: ["fake-card-id"],
      }),
    ).rejects.toThrow();

    console.log(`    ✓ Judge play correctly rejected`);
    console.log(`    ✓ Duplicate submission correctly rejected`);
  }, 15000);

  // ─── Step 3: Select Winner ───────────────────────────────────

  it("Step 3: Judge selects winner → score awarded, phase to roundEnd", async () => {
    const { gameState } = await getLobbyState(lobbyId);
    const judgeId = gameState.judgeId;

    // Pick a winner (first non-judge player)
    const winnerId = TEST_PLAYERS.find((p) => p.userId !== judgeId)!.userId;

    const result = await callApi("/api/game/select-winner", {
      lobbyId,
      winnerId,
    });

    expect(result.success).toBe(true);
    // Verify winningCards returned in API response (synchronous path)
    expect(result.winningCards).toBeTruthy();
    expect(result.winningCards.length).toBeGreaterThan(0);

    const updated = await getLobbyState(lobbyId);
    expect(updated.gameState.phase).toBe("roundEnd");
    expect(updated.gameState.roundWinner).toBe(winnerId);
    expect(updated.gameState.scores[winnerId]).toBe(1);
    expect(updated.gameState.winningCards).toBeTruthy();
    expect(updated.gameState.winningCards.length).toBeGreaterThan(0);
    expect(updated.gameState.roundEndStartTime).toBeGreaterThan(0);

    console.log(
      `    Winner: ${winnerId} (score: ${updated.gameState.scores[winnerId]})`,
    );
    console.log(
      `    Winning cards: [${updated.gameState.winningCards.join(", ")}]`,
    );
    console.log(`    Phase: ${updated.gameState.phase}`);
  }, 15000);

  // ─── Step 4: Next Round ──────────────────────────────────────

  it("Step 4: Start next round → judge rotates, new black card, hands refilled", async () => {
    // Wait for the countdown to elapse (the server checks 80% of countdown)
    // Default countdown is 5s, 80% = 4s
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const beforeState = (await getLobbyState(lobbyId)).gameState;
    const previousJudge = beforeState.judgeId;
    const previousBlackCard = beforeState.blackCard;

    const result = await callApi("/api/game/next-round", { lobbyId });

    expect(result.success).toBe(true);

    const { gameState } = await getLobbyState(lobbyId);
    expect(gameState.phase).toBe("submitting");
    expect(gameState.round).toBe(2);

    // Judge should have rotated
    expect(gameState.judgeId).not.toBe(previousJudge);

    // New black card should be drawn
    expect(gameState.blackCard).toBeTruthy();
    expect(gameState.blackCard.id).not.toBe(previousBlackCard.id);

    // Previous round state should be cleared
    expect(gameState.roundWinner).toBeNull();
    expect(gameState.winningCards).toBeNull();
    expect(Object.keys(gameState.submissions)).toHaveLength(0);

    // Verify hands are refilled
    const gameCards = await getGameCards(lobbyId);
    for (const player of TEST_PLAYERS) {
      const hand = gameCards!.hands[player.userId]!;
      expect(hand.length).toBe(5); // All hands should be full again
    }

    console.log(`    Round: ${gameState.round}`);
    console.log(`    New judge: ${gameState.judgeId} (was: ${previousJudge})`);
    console.log(`    New black card: "${gameState.blackCard.text}"`);
    console.log(`    All hands refilled to 5 cards ✓`);
  }, 15000);

  // ─── Step 5: Play a second round to verify continuity ────────

  it("Step 5: Second round plays through successfully", async () => {
    const { gameState } = await getLobbyState(lobbyId);
    const judgeId = gameState.judgeId;
    const gameCards = await getGameCards(lobbyId);
    const pick = gameState.blackCard.pick || 1;
    const nonJudgePlayers = TEST_PLAYERS.filter((p) => p.userId !== judgeId);

    // Submit cards
    for (const player of nonJudgePlayers) {
      const hand = gameCards!.hands[player.userId]!;
      await callApi("/api/game/play-card", {
        lobbyId,
        playerId: player.userId,
        cardIds: hand.slice(0, pick),
      });
    }

    // Verify judging phase
    const afterPlay = await getLobbyState(lobbyId);
    expect(afterPlay.gameState.phase).toBe("judging");

    // Select winner — track their current score first
    const winnerId = nonJudgePlayers[0]!.userId;
    const previousScore = gameState.scores[winnerId] || 0;
    await callApi("/api/game/select-winner", { lobbyId, winnerId });

    const afterWinner = await getLobbyState(lobbyId);
    expect(afterWinner.gameState.scores[winnerId]).toBe(previousScore + 1);
    expect(afterWinner.gameState.phase).toBe("roundEnd");

    console.log(
      `    Round 2 complete. ${winnerId} now has ${afterWinner.gameState.scores[winnerId]} points.`,
    );
  }, 30000);

  // ─── Summary ─────────────────────────────────────────────────

  it("Step 6: Final state verification", async () => {
    const { gameState } = await getLobbyState(lobbyId);

    console.log("\n  ═══════════════════════════════════════");
    console.log("  GAMEPLAY INTEGRATION TEST SUMMARY");
    console.log("  ═══════════════════════════════════════");
    console.log(`  Rounds played: ${gameState.round}`);
    console.log(`  Scores: ${JSON.stringify(gameState.scores)}`);
    console.log(`  Current phase: ${gameState.phase}`);
    console.log(`  Current judge: ${gameState.judgeId}`);
    console.log("  ═══════════════════════════════════════\n");

    // Basic sanity checks
    expect(gameState.round).toBe(2);
    expect(
      Object.values(gameState.scores as Record<string, number>).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBe(2);
  });
});
