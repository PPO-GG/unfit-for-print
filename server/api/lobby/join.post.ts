import { eq, and } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, lobbyPasswords, players } from "~~/server/db/schema";
import { verifyLobbyPassword } from "~~/server/utils/lobbyPassword";
import { requireAuth } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{
    code: string;
    playerName: string;
    avatar?: string;
    // "bot" is intentionally not accepted here — bots may only be created
    // via the dedicated /api/bot/add route (host-only, synthetic user).
    // A client-supplied "bot" is clamped to "player" below so a real user
    // can never get themselves classified (and later deleted) as a bot.
    playerType?: "spectator" | "player";
    password?: string;
  }>(event);

  const db = useDb();
  const [lobby] = await db.select().from(lobbies).where(eq(lobbies.code, body.code)).limit(1);
  if (!lobby) throw createError({ statusCode: 404, statusMessage: "Lobby not found" });

  const [existing] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.lobbyId, lobby.id)))
    .limit(1);
  if (existing) return { lobby, player: existing };

  // Password challenge. Deliberately below the `existing` early-return above:
  // someone already seated must not be locked out of their own game by a
  // password the host set after they joined.
  const [protection] = await db
    .select({ hash: lobbyPasswords.hash })
    .from(lobbyPasswords)
    .where(eq(lobbyPasswords.lobbyId, lobby.id))
    .limit(1);

  if (protection) {
    const supplied = typeof body.password === "string" ? body.password : "";
    const ok =
      supplied.length > 0 &&
      (await verifyLobbyPassword(protection.hash, supplied));
    if (!ok) {
      // One message for both "missing" and "wrong" — telling them apart only
      // helps someone probing codes to learn which lobbies are protected.
      throw createError({
        statusCode: 403,
        statusMessage: "Incorrect lobby password",
      });
    }
  }

  // Runtime clamp: TypeScript's narrowed body type doesn't stop a raw
  // request body from smuggling "bot" (or anything else) past readBody.
  const requestedType = body.playerType === "spectator" ? "spectator" : "player";

  // A lobby that is no longer waiting only takes spectators. Seating someone as
  // an active player mid-round would put them in the players table while the
  // Y.Doc's playerOrder, hands and scores know nothing about them — the doc is
  // authoritative for gameplay and it is not consulted here. Latecomers are
  // meant to arrive as spectators and be dealt in explicitly via the engine's
  // convertToPlayer, which does update the doc.
  //
  // This is deliberately below the `existing` early-return above, so a player
  // whose tab dropped mid-round reconnects as a player rather than being
  // demoted to spectator.
  const playerType = lobby.status === "waiting" ? requestedType : "spectator";

  const [player] = await db
    .insert(players)
    .values({
      userId,
      lobbyId: lobby.id,
      name: body.playerName,
      avatar: body.avatar,
      isHost: false,
      playerType,
    })
    .returning();

  return { lobby, player };
});
