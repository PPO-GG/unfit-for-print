import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { users } from "~~/server/db/schema";
import { recordActivity } from "~~/server/utils/activity";
import { createLobbyRow } from "~~/server/utils/createLobbyRow";
import { requireNonGuest } from "~~/server/utils/session";

export default defineEventHandler(async (event) => {
  // Hosting creates durable state other people join, so it needs a real
  // account. The home page already hides this from guests; this is the half
  // a client cannot skip.
  const userId = await requireNonGuest(event);
  const body = await readBody<{
    hostUserId: string;
    lobbyName?: string;
    discordInstanceId?: string;
    discordChannelId?: string;
    vcOnly?: boolean;
    isPrivate?: boolean;
  }>(event);

  const db = useDb();
  const [hostUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!hostUser) throw createError({ statusCode: 404, statusMessage: "User not found" });

  const lobby = await createLobbyRow(db, hostUser, {
    lobbyName: body.lobbyName,
    discordInstanceId: body.discordInstanceId,
    discordChannelId: body.discordChannelId,
    vcOnly: body.vcOnly,
    isPrivate: body.isPrivate,
  });

  await recordActivity("lobby_created", lobby.id, userId);
  await recordActivity("player_joined", lobby.id, userId);

  return lobby;
});
