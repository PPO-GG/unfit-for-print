import { and, asc, eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";
import { deleteUnreferencedGuests } from "~~/server/utils/guestUsers";

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const { lobbyId } = await readBody<{ lobbyId: string }>(event);

  const db = useDb();

  // One transaction, so a failure part-way cannot leave the lobby without its
  // host or delete an account the lobby still points at.
  const { newHostUserId, lobbyClosed, deletedSelf } = await db.transaction(async (tx: any) => {
    await tx.delete(players).where(and(eq(players.userId, userId), eq(players.lobbyId, lobbyId)));

    // Earliest first, which is the order the host role is handed down in.
    const remaining: Array<{ userId: string; playerType: string; isGuest: boolean }> = await tx
      .select({
        userId: players.userId,
        playerType: players.playerType,
        isGuest: users.isGuest,
      })
      .from(players)
      .innerJoin(users, eq(users.id, players.userId))
      .where(eq(players.lobbyId, lobbyId))
      .orderBy(asc(players.joinedAt));
    const remainingHumans = remaining.filter((p) => p.playerType !== "bot");

    const [lobby] = await tx
      .select({ hostUserId: lobbies.hostUserId })
      .from(lobbies)
      .where(eq(lobbies.id, lobbyId));

    // Only a signed-in account may host — the same rule lobby/create enforces
    // with requireNonGuest. A seated player before a spectator, matching the
    // client, which only promotes seated players in the Y.Doc.
    let newHostUserId: string | null = null;
    let lobbyClosed = remainingHumans.length === 0;
    if (!lobbyClosed && lobby?.hostUserId === userId) {
      const signedIn = remainingHumans.filter((p) => !p.isGuest);
      const next = signedIn.find((p) => p.playerType === "player") ?? signedIn[0];
      if (next) {
        newHostUserId = next.userId;
      } else {
        // Nobody left may host, so the lobby ends and the leaving client tells
        // the others to go home. Only reachable on the web: everyone in the
        // Discord Activity is signed in.
        lobbyClosed = true;
      }
    }

    // Guest accounts to try deleting: the caller's, plus everyone's in a lobby
    // being closed (bots have synthetic guest rows too).
    const guestCandidates = new Set([userId]);

    if (lobbyClosed) {
      // Players cascade with the lobby.
      await tx.delete(lobbies).where(eq(lobbies.id, lobbyId));
      for (const p of remaining) guestCandidates.add(p.userId);
    } else if (newHostUserId) {
      // The lobby row has to stop naming the caller as host before their
      // account can go, and host-only routes (requireHost) read this row, so
      // without the handoff nobody left could start the game or manage bots.
      await tx.update(lobbies).set({ hostUserId: newHostUserId }).where(eq(lobbies.id, lobbyId));
      await tx
        .update(players)
        .set({ isHost: true })
        .where(and(eq(players.userId, newHostUserId), eq(players.lobbyId, lobbyId)));
    }

    const deleted = await deleteUnreferencedGuests(tx, [...guestCandidates]);
    return { newHostUserId, lobbyClosed, deletedSelf: deleted.includes(userId) };
  });

  // Deleting the account without dropping the cookie left the caller holding a
  // session for a user that no longer exists — every later request authenticated
  // as a dead id until something hit a foreign key.
  if (deletedSelf) await clearUserSession(event);

  // The leaving client mirrors both into the Y.Doc: it promotes the same new
  // host, or marks the lobby closed so everyone else is sent home.
  return { success: true, newHostUserId, lobbyClosed };
});
