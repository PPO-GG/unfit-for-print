import { and, asc, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";
import { deleteUnreferencedGuests } from "~~/server/utils/guestUsers";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { lobbyId } = await readBody<{ lobbyId: string }>(event);

  const db = useDb();

  // One transaction, so a failure part-way cannot leave the lobby without its
  // host or delete an account the lobby still points at.
  const { newHostUserId, deletedSelf } = await db.transaction(async (tx: any) => {
    await tx.delete(players).where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)));

    // Earliest first, which is the order the host role is handed down in.
    const remaining: Array<{ userId: string; playerType: string }> = await tx
      .select({ userId: players.userId, playerType: players.playerType })
      .from(players)
      .where(eq(players.lobbyId, lobbyId))
      .orderBy(asc(players.joinedAt));
    const remainingHumans = remaining.filter((p) => p.playerType !== "bot");

    // Guest accounts to try deleting: the caller's, plus everyone's in a lobby
    // being torn down (bots have synthetic guest rows too).
    const guestCandidates = new Set([userId]);
    let newHostUserId: string | null = null;

    if (remainingHumans.length === 0) {
      // Players cascade with the lobby.
      await tx.delete(lobbies).where(eq(lobbies.id, lobbyId));
      for (const p of remaining) guestCandidates.add(p.userId);
    } else {
      // The lobby row has to stop naming the caller as host before their
      // account can go — and host-only routes (requireHost) read this row, so
      // without a handoff nobody left could start the game or manage bots.
      const [lobby] = await tx
        .select({ hostUserId: lobbies.hostUserId })
        .from(lobbies)
        .where(eq(lobbies.id, lobbyId));

      if (lobby?.hostUserId === userId) {
        // A seated player before a spectator, matching the client, which only
        // promotes players in the Y.Doc.
        const next =
          remainingHumans.find((p) => p.playerType === "player") ?? remainingHumans[0]!;
        newHostUserId = next.userId;

        await tx.update(lobbies).set({ hostUserId: newHostUserId }).where(eq(lobbies.id, lobbyId));
        await tx
          .update(players)
          .set({ isHost: true })
          .where(and(eq(players.userId, newHostUserId), eq(players.lobbyId, lobbyId)));
      }
    }

    const deleted = await deleteUnreferencedGuests(tx, [...guestCandidates]);
    return { newHostUserId, deletedSelf: deleted.includes(userId) };
  });

  // Deleting the account without dropping the cookie left the caller holding a
  // session for a user that no longer exists — every later request authenticated
  // as a dead id until something hit a foreign key.
  if (deletedSelf) await clearUserSession(event);

  // `newHostUserId` lets the leaving client promote the same player in the
  // Y.Doc that was just promoted here.
  return { success: true, newHostUserId };
});
