import { eq } from "drizzle-orm";
import { useDb } from "~~/server/db/client";
import { lobbies, players, users } from "~~/server/db/schema";
import { requireAuth } from "~~/server/utils/session";

function randomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default defineEventHandler(async (event) => {
  const userId = await requireAuth(event);
  const body = await readBody<{
    hostUserId: string;
    lobbyName?: string;
    discordInstanceId?: string;
    discordChannelId?: string;
    vcOnly?: boolean;
  }>(event);

  const db = useDb();
  const [hostUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!hostUser) throw createError({ statusCode: 404, statusMessage: "User not found" });

  let code = randomCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const [existing] = await db.select({ id: lobbies.id }).from(lobbies).where(eq(lobbies.code, code));
    if (!existing) break;
    code = randomCode();
  }

  const [lobby] = await db
    .insert(lobbies)
    .values({
      code,
      hostUserId: userId,
      lobbyName: body.lobbyName,
      discordInstanceId: body.discordInstanceId,
      discordChannelId: body.discordChannelId,
      vcOnly: body.vcOnly ?? false,
    })
    .returning();

  await db.insert(players).values({
    userId,
    lobbyId: lobby.id,
    name: hostUser.name,
    avatar: hostUser.avatarUrl,
    isHost: true,
    playerType: "player",
  });

  return lobby;
});
