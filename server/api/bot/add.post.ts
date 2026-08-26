// server/api/bot/add.post.ts
// Allows the lobby host to add a bot player to the lobby.
// Bots are represented by a synthetic row in `users` (isGuest, no auth
// identity attached) plus a `players` row with playerType='bot' — the
// `players.userId` column is a NOT NULL FK to `users.id`, so every bot
// needs a real (if synthetic) user row to satisfy the constraint.
//
// Auth: session-based, verified via requireHost.
import { and, eq, isNull } from "drizzle-orm";
import { useDb } from "~/server/db/client";
import { lobbies, players, users } from "~/server/db/schema";
import { requireHost } from "~/server/utils/session";
import { generateBotName, getBotAvatarUrl } from "~/server/utils/botNames";

const MAX_BOTS_PER_LOBBY = 5;

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const { lobbyId, activeBotUserIds } = body;

  if (!lobbyId) {
    throw createError({
      statusCode: 400,
      statusMessage: "lobbyId is required",
    });
  }

  // Session-based auth: verify the caller is the authenticated host
  await requireHost(event, lobbyId);

  const db = useDb();

  const [lobby] = await db
    .select()
    .from(lobbies)
    .where(eq(lobbies.id, lobbyId))
    .limit(1);
  if (!lobby) {
    throw createError({ statusCode: 404, statusMessage: "Lobby not found" });
  }

  let existingBots = await db
    .select()
    .from(players)
    .where(and(eq(players.lobbyId, lobbyId), eq(players.playerType, "bot")));

  // If the client sent its authoritative bot list (from Y.Doc), prune any
  // bot rows that aren't in that list — these are orphans left behind by
  // a previous session that didn't clean up properly.
  if (
    Array.isArray(activeBotUserIds) &&
    activeBotUserIds.length < existingBots.length
  ) {
    const activeSet = new Set(activeBotUserIds);
    const orphans = existingBots.filter((p) => !activeSet.has(p.userId));
    if (orphans.length > 0) {
      await Promise.all(
        orphans.map((p) => db.delete(players).where(eq(players.id, p.id))),
      );
      // Clean up the synthetic user rows too, now that nothing references
      // them. Defense-in-depth: only delete rows that actually look
      // synthetic (guest, no Discord identity) in case a bug elsewhere
      // ever let a real account's player row end up playerType='bot'.
      await Promise.all(
        orphans.map((p) =>
          db
            .delete(users)
            .where(
              and(
                eq(users.id, p.userId),
                eq(users.isGuest, true),
                isNull(users.discordUserId),
              ),
            ),
        ),
      );
    }
    // Recompute list after pruning
    existingBots = existingBots.filter((p) => activeSet.has(p.userId));
  }

  if (existingBots.length >= MAX_BOTS_PER_LOBBY) {
    throw createError({
      statusCode: 400,
      statusMessage: `Maximum of ${MAX_BOTS_PER_LOBBY} bots per lobby`,
    });
  }

  // --- Check lobby status (only allow adding bots in waiting phase) ---
  if (lobby.status !== "waiting") {
    throw createError({
      statusCode: 400,
      statusMessage: "Can only add bots while waiting",
    });
  }

  // --- Generate bot identity ---
  // Collect existing bot names in this lobby to avoid name collisions
  const existingBotNames = existingBots.map((p) => p.name);
  const botName = generateBotName(existingBotNames);
  const botAvatar = getBotAvatarUrl(botName);

  // --- Create the synthetic bot user, then the player row ---
  const [botUser] = await db
    .insert(users)
    .values({ isGuest: true, name: botName, avatarUrl: botAvatar })
    .returning();

  const [player] = await db
    .insert(players)
    .values({
      userId: botUser!.id,
      lobbyId,
      name: botName,
      avatar: botAvatar,
      isHost: false,
      playerType: "bot",
    })
    .returning();

  return {
    success: true,
    bot: {
      id: player!.id,
      userId: botUser!.id,
      name: botName,
      avatar: botAvatar,
      playerType: "bot",
    },
  };
});
